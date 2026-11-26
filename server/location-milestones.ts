import type { Actor } from '@/domain/types';
import { milestoneGrantIds, normalizeMilestone, unlockMilestoneOf, type MilestoneCandidate } from '@/domain/location-milestones';
import { cmsPublisher, getLocationNode, requireCmsPublisher } from './location-cms-service';
import { HttpError } from './access';

const parse = (raw: string | null | undefined): Record<string, unknown> => {
  try { const value: unknown = JSON.parse(raw || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  catch { return {}; }
};
const knownStates = ['known', 'visited', 'investigated'];

/** Binds an Erkenntnis to a milestone, or removes the binding (milestone null). Version protected by the node revision. */
export async function setInformationUnlock(db: D1Database, a: Actor, input: { entityId: string; expectedRevision: number; milestone: string | null; reason: string }) {
  requireCmsPublisher(a);
  const node = await getLocationNode(db, a, input.entityId);
  if (node.level !== 'information') throw new HttpError(400, 'Nur Erkenntnisse können an einen Meilenstein gebunden werden.');
  if (node.revision !== input.expectedRevision) throw new HttpError(409, 'Die Erkenntnis wurde inzwischen geändert. Bitte lade neu.');
  let label: string | null = null;
  if (input.milestone !== null) {
    label = normalizeMilestone(input.milestone);
    if (!label) throw new HttpError(400, 'Der Meilenstein braucht einen Namen mit höchstens 80 Zeichen.');
  }
  const attributes = { ...parse(node.attributes) };
  if (label) attributes.unlockMilestone = label; else delete attributes.unlockMilestone;
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const result = await db.batch([
    db.prepare('UPDATE location_nodes SET attributes=?,revision=revision+1,updated_at=? WHERE campaign_id=? AND entity_id=? AND revision=?')
      .bind(JSON.stringify(attributes), now, a.campaignId, input.entityId, input.expectedRevision),
    db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
      SELECT ?,?,?,?,'location.unlock.changed',?,? WHERE changes()=1`)
      .bind(eventId, a.campaignId, input.entityId, a.id, JSON.stringify({ milestone: label, reason: input.reason, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1 }), now),
  ]);
  if (!result[0].meta.changes) throw new HttpError(409, 'Die Erkenntnis wurde inzwischen geändert. Bitte lade neu.');
  return { ok: true, entityId: input.entityId, milestone: label, revision: input.expectedRevision + 1 };
}

/** The SL reaches a milestone during play. Every bound Erkenntnis that the group does not know yet is granted, including
 * ones bound after an earlier reach. The event row is written once per name; the grant is idempotent. */
export async function fireMilestone(db: D1Database, a: Actor, input: { label: string; reason: string }) {
  requireCmsPublisher(a);
  const label = normalizeMilestone(input.label);
  if (!label) throw new HttpError(400, 'Der Meilenstein braucht einen Namen mit höchstens 80 Zeichen.');
  const rows = (await db.prepare(`SELECT n.entity_id AS id,n.level,n.attributes,e.canon_status AS canonStatus,e.content
      FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
      WHERE n.campaign_id=? AND n.level='information'`).bind(a.campaignId).all<{ id: string; level: string; attributes: string; canonStatus: string; content: string }>()).results;
  const candidates: MilestoneCandidate[] = rows.map(row => ({ id: row.id, level: row.level, attributes: parse(row.attributes), canonStatus: row.canonStatus, content: parse(row.content) }));
  const bound = milestoneGrantIds(candidates, label);
  const known = new Set<string>();
  if (bound.length) {
    const current = (await db.prepare(`SELECT entity_id,discovery_state FROM knowledge WHERE campaign_id=? AND audience='group' AND subject_id=? AND entity_id IN (${bound.map(() => '?').join(',')})`)
      .bind(a.campaignId, a.campaignId, ...bound).all<{ entity_id: string; discovery_state: string | null }>()).results;
    for (const row of current) if (knownStates.includes(String(row.discovery_state))) known.add(row.entity_id);
  }
  const fresh = bound.filter(id => !known.has(id));
  const reached = await db.prepare("SELECT id FROM world_events WHERE campaign_id=? AND type='milestone.reached' AND json_extract(payload,'$.label')=? LIMIT 1")
    .bind(a.campaignId, label).first<{ id: string }>();
  const now = new Date().toISOString();
  const statements = [];
  if (!reached) statements.push(db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
      SELECT ?,?,NULL,?,'milestone.reached',?,? WHERE NOT EXISTS(SELECT 1 FROM world_events WHERE campaign_id=? AND type='milestone.reached' AND json_extract(payload,'$.label')=?)`)
    .bind(crypto.randomUUID(), a.campaignId, a.id, JSON.stringify({ label, reason: input.reason, granted: fresh.length }), now, a.campaignId, label));
  // Group knowledge: never lowers an existing state, only lifts hidden or rumored Erkenntnisse to "known".
  for (const id of fresh) {
    statements.push(db.prepare(`INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at)
      VALUES(?,?,?,'group',?,'DISCOVERED','known',1,?,?,?)
      ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO UPDATE SET
        state=CASE WHEN knowledge.state='VERIFIED' THEN knowledge.state ELSE 'DISCOVERED' END,
        discovery_state=CASE WHEN knowledge.discovery_state IN ('known','visited','investigated') THEN knowledge.discovery_state ELSE 'known' END,
        version=knowledge.version+1,granted_by=excluded.granted_by,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), a.campaignId, id, a.campaignId, a.id, now, now));
  }
  if (statements.length) await db.batch(statements);
  return { ok: true, label, already: !!reached, granted: fresh.length };
}

/** Players: reached names and times, never the SL's reason or the actor. SL only: bound names not reached yet, with counts. */
export async function listMilestones(db: D1Database, a: Actor) {
  const rows = (await db.prepare("SELECT payload,created_at FROM world_events WHERE campaign_id=? AND type='milestone.reached' ORDER BY created_at DESC LIMIT 50")
    .bind(a.campaignId).all<{ payload: string; created_at: string }>()).results;
  const milestones = rows.map(row => {
    const data = parse(row.payload);
    return { label: String(data.label ?? ''), reachedAt: row.created_at, granted: Number(data.granted ?? 0) };
  }).filter(item => item.label);
  if (!cmsPublisher(a)) return { milestones };
  const reachedNames = new Set(milestones.map(item => item.label));
  const bound = (await db.prepare("SELECT attributes FROM location_nodes WHERE campaign_id=? AND level='information'").bind(a.campaignId).all<{ attributes: string }>()).results;
  const counts = new Map<string, number>();
  for (const row of bound) {
    const label = unlockMilestoneOf(parse(row.attributes));
    if (label && !reachedNames.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { milestones, pending: [...counts].map(([label, count]) => ({ label, count })).sort((x, y) => x.label.localeCompare(y.label, 'de-DE')) };
}
