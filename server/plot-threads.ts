import type { Actor } from '@/domain/types';
import { threadDocumentSchema, type ClueKnowledge, type ThreadCommand, type ThreadDocument, type ThreadHistory, type ThreadView } from '@/domain/plot-threads';
import { HttpError } from '@/server/database';
import { gmOnly } from '@/server/access';
import { loadEntitiesForIds, parseObject, type EntityRow } from '@/server/entities';
import { readStory, validateCommandReferences } from '@/server/command-workspace';

/** Storyboard 2.0, Phase 3: plot threads. One SL-only NOTE entity per thread (documentKind plot_thread); every write is a
 * compare-and-set on its version with an audit event in the same batch. Players never read this (gmOnly everywhere). */
const predicate = "type='NOTE' AND canon_status='GM_SECRET' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='plot_thread'";
const sceneWhere = "type='SCENE' AND canon_status='WORKING' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='story_scene'";
/** Dossier kinds a strand may concern. Recovery-only data is rejected by validateCommandReferences. */
const refTypes = ['NPC', 'PLACE', 'CLUE', 'HANDOUT', 'FACTION', 'CHARACTER', 'ITEM'];

function decode(row: EntityRow): ThreadView {
  const parsed = threadDocumentSchema.safeParse({ ...(parseObject(row.content).document as object || {}), title: row.title });
  if (!parsed.success) throw new HttpError(409, 'Dieser Handlungsstrang enthält einen nicht unterstützten Stand. Vorhandene Daten werden nicht überschrieben.');
  return { id: row.id, version: row.version, updatedAt: row.updated_at, document: parsed.data };
}
export async function readThread(db: D1Database, a: Actor, id: string): Promise<ThreadView> {
  gmOnly(a);
  const row = await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id=? AND ${predicate}`).bind(a.campaignId, id).first<EntityRow>();
  if (!row) throw new HttpError(404, 'Handlungsstrang nicht verfügbar.');
  return decode(row);
}
/** All threads; one unreadable thread does not break the list (it is skipped and reported by its id). */
export async function listThreads(db: D1Database, a: Actor): Promise<{ threads: ThreadView[]; unsupported: string[] }> {
  gmOnly(a);
  const rows = (await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND ${predicate} ORDER BY title,id LIMIT 300`).bind(a.campaignId).all<EntityRow>()).results;
  const threads: ThreadView[] = [], unsupported: string[] = [];
  for (const row of rows) { try { threads.push(decode(row)); } catch { unsupported.push(row.id); } }
  return { threads, unsupported };
}
export async function threadHistory(db: D1Database, a: Actor, id: string): Promise<ThreadHistory[]> {
  await readThread(db, a, id);
  const rows = await db.prepare("SELECT id,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type LIKE 'command.thread.%' ORDER BY json_extract(payload,'$.version') DESC LIMIT 60")
    .bind(a.campaignId, id).all<{ id: string; payload: string; created_at: string }>();
  return rows.results.flatMap(row => { const p = parseObject(row.payload), d = threadDocumentSchema.safeParse(p.document); return d.success && typeof p.version === 'number' ? [{ id: row.id, version: p.version, createdAt: row.created_at, document: d.data }] : []; });
}

/** Books must be existing plot dossiers, dossiers must exist and fit, scenes must be scenes of this campaign.
 * Links that were already stored and whose target disappeared later stay (shown as unavailable), new ones must resolve. */
async function validate(db: D1Database, a: Actor, d: ThreadDocument, before: ThreadDocument | null) {
  for (const bookId of d.bookIds) if (!before?.bookIds.includes(bookId)) await readStory(db, a, bookId);
  const keptRefs = new Set(before?.strands.flatMap(s => s.refIds) || []), keptScenes = new Set(before?.strands.map(s => s.sceneId).filter(Boolean) || []);
  const refs = [...new Set(d.strands.flatMap(s => s.refIds))].filter(ref => !keptRefs.has(ref));
  if (refs.length) {
    await validateCommandReferences(db, a, refs);
    const entities = await loadEntitiesForIds(db, a.campaignId, refs);
    if (entities.some(e => !refTypes.includes(e.type))) throw new HttpError(400, 'Ein Faden kann nur Figuren, Orte, Hinweise, Handouts, Fraktionen oder Gegenstände verknüpfen.');
  }
  const scenes = [...new Set(d.strands.map(s => s.sceneId).filter(Boolean))].filter(sid => !keptScenes.has(sid));
  if (scenes.length) {
    const found = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND id IN (${scenes.map(() => '?').join(',')}) AND ${sceneWhere}`).bind(a.campaignId, ...scenes).all<{ id: string }>();
    if (found.results.length !== scenes.length) throw new HttpError(400, 'Eine vorgemerkte Szene ist nicht verfügbar.');
  }
}

export async function executeThread(db: D1Database, a: Actor, command: ThreadCommand): Promise<ThreadView> {
  gmOnly(a);
  const create = command.action === 'create', id = create ? 'thread-' + command.clientRequestId : command.id;
  const before = create ? null : await readThread(db, a, id);
  if (before && command.action !== 'create' && before.version !== command.version) throw new HttpError(409, 'Dieser Handlungsstrang wurde inzwischen verändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand zum Vergleichen.');
  let document: ThreadDocument;
  if (command.action === 'restore') {
    const entry = (await threadHistory(db, a, id)).find(h => h.id === command.historyId);
    if (!entry) throw new HttpError(404, 'Dieser Stand ist nicht mehr verfügbar.');
    document = entry.document;
  } else document = command.document;
  await validate(db, a, document, before?.document || null);
  const { title, ...rest } = document;
  const content = JSON.stringify({ documentKind: 'plot_thread', canonStatus: 'GM_SECRET', document: rest });
  const now = new Date().toISOString(), version = before ? before.version + 1 : 1;
  const mutation = create
    ? db.prepare(`INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES(?,?,'NOTE','GM_SECRET',?,'sl',?,?,'',1,?,?)`).bind(id, a.campaignId, a.id, title, content, now, now)
    : db.prepare(`UPDATE entities SET title=?,content=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND ${predicate}`).bind(title, content, now, a.campaignId, id, before!.version);
  const event = db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(), a.campaignId, id, a.id, 'command.thread.' + (create ? 'created' : command.action === 'restore' ? 'restored' : 'saved'), JSON.stringify({ version, document }), now);
  const [result] = await db.batch([mutation, event]);
  if (result.meta.changes !== 1) {
    if (create) {
      // Retry of the same create request: return the stored thread when the content matches, otherwise refuse.
      const prior = await readThread(db, a, id).catch(() => null);
      if (prior && prior.version === 1 && JSON.stringify(threadDocumentSchema.parse(prior.document)) === JSON.stringify(threadDocumentSchema.parse(document))) return prior;
    }
    throw new HttpError(409, 'Dieser Handlungsstrang wurde inzwischen verändert. Deine Eingaben bleiben erhalten.');
  }
  return readThread(db, a, id);
}

/** Real discovery of linked clue dossiers: "known" when any audience holds a state other than UNKNOWN. Read only. */
export async function clueKnowledge(db: D1Database, a: Actor, threads: ThreadView[]): Promise<ClueKnowledge> {
  gmOnly(a);
  const refs = [...new Set(threads.flatMap(t => t.document.strands.filter(s => s.kind === 'clue').flatMap(s => s.refIds)))];
  if (!refs.length) return {};
  const clues = (await loadEntitiesForIds(db, a.campaignId, refs)).filter(e => e.type === 'CLUE' || e.type === 'HANDOUT').map(e => e.id);
  if (!clues.length) return {};
  const rows = await db.prepare(`SELECT entity_id, MAX(CASE WHEN state<>'UNKNOWN' THEN 1 ELSE 0 END) AS known FROM knowledge WHERE campaign_id=? AND entity_id IN (${clues.map(() => '?').join(',')}) GROUP BY entity_id`).bind(a.campaignId, ...clues).all<{ entity_id: string; known: number }>();
  const out: ClueKnowledge = Object.fromEntries(clues.map(cid => [cid, 'unknown' as const]));
  for (const row of rows.results) if (row.known) out[row.entity_id] = 'known';
  return out;
}

/** For scene saves: thread ids a scene joins must exist (already stored ones may stay if a thread disappears). */
export async function validateSceneThreads(db: D1Database, a: Actor, ids: string[], kept: string[] = []) {
  const wanted = [...new Set(ids)].filter(tid => !kept.includes(tid));
  if (!wanted.length) return;
  const found = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND id IN (${wanted.map(() => '?').join(',')}) AND ${predicate}`).bind(a.campaignId, ...wanted).all<{ id: string }>();
  if (found.results.length !== wanted.length) throw new HttpError(400, 'Ein zugeordneter Handlungsstrang ist nicht verfügbar.');
}
