// Öffentliche Welt: the only server path from campaign data to anonymous website visitors.
// Rule: an entry appears on the website only when (1) the SL set its explicit website flag, read from the raw stored
// JSON, and (2) the existing *group* projection already shows it. Content always comes from that projection and is
// then reduced to an allowlist (domain/public-world.ts). Nothing here writes, except the SL-only place flag setter.
import type { Actor } from "@/domain/types";
import { hasNPCFieldVisibility, npcFieldVisibility } from "@/domain/npc-profile";
import {
  isMarkedForWebsite, publicChronicleEntry, publicPerson, publicPlace, sortPublicChronicle, websiteFlagKeys,
  type PublicChronicleEntry, type PublicPerson, type PublicPlace, type PublicWorld,
} from "@/domain/public-world";
import { HttpError } from "@/server/database";
import { loadEntitiesForIds, projectEntity, type GrantRow } from "@/server/entities";
import { getLocationNode, requireCmsPublisher } from "@/server/location-cms-service";
import { loadLocationHub } from "@/server/location-repository";

/** Read-only stand-in for "the whole group, nobody in particular". The id can never match a member id, so owner rules
 * (records, entities) never apply; gm is false and only group grants are loaded. Never pass it to a writer. */
const PUBLIC_VIEWER_ID = "@öffentliche-website";
export function publicViewer(campaignId: string): Actor {
  return { id: PUBLIC_VIEWER_ID, campaignId, email: "", name: "Website", gm: false, role: "player", status: "active" };
}

const parse = (raw: string | null | undefined): Record<string, unknown> => {
  try { const value: unknown = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  catch { return {}; }
};
const chunks = <T,>(values: T[], size = 70) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

async function groupGrants(db: D1Database, campaignId: string, ids: string[]): Promise<GrantRow[]> {
  const grants: GrantRow[] = [];
  for (const batch of chunks(ids)) {
    const result = await db.prepare(`SELECT entity_id,audience,subject_id,state FROM knowledge WHERE campaign_id=? AND audience='group' AND subject_id=? AND entity_id IN (${batch.map(() => "?").join(",")})`)
      .bind(campaignId, campaignId, ...batch).all<GrantRow>();
    grants.push(...result.results);
  }
  return grants;
}

export async function loadPublicPlaces(db: D1Database, campaignId: string): Promise<PublicPlace[]> {
  const roots = await db.prepare("SELECT entity_id,attributes FROM location_nodes WHERE campaign_id=? AND level='location' AND parent_id IS NULL AND location_id=entity_id")
    .bind(campaignId).all<{ entity_id: string; attributes: string }>();
  // The flag is read from the stored attributes: a released place's projection uses its release payload instead.
  const marked = new Set(roots.results.filter(row => isMarkedForWebsite(parse(row.attributes), websiteFlagKeys.place)).map(row => row.entity_id));
  if (!marked.size) return [];
  const projections = await loadLocationHub(db, publicViewer(campaignId), "player", "group");
  return projections.flatMap(projection => {
    if (projection.view !== "player" || !marked.has(projection.location.id)) return [];
    const place = publicPlace(projection.location);
    return place ? [place] : [];
  });
}

export async function loadPublicPeople(db: D1Database, campaignId: string): Promise<PublicPerson[]> {
  const rows = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND type='NPC'
    AND json_extract(CASE WHEN json_valid(content) THEN content ELSE '{}' END,'$.${websiteFlagKeys.person}')=1 ORDER BY title,id`)
    .bind(campaignId).all<{ id: string }>();
  const ids = rows.results.map(row => row.id);
  if (!ids.length) return [];
  const [entities, grants] = await Promise.all([loadEntitiesForIds(db, campaignId, ids), groupGrants(db, campaignId, ids)]);
  const viewer = publicViewer(campaignId);
  const people = entities.flatMap(entity => {
    if (entity.type !== "NPC" || !isMarkedForWebsite(entity.content, websiteFlagKeys.person)) return [];
    // A person whose name is not released stays anonymous for the group; the website never shows anonymous figures.
    if (hasNPCFieldVisibility(entity.content) && npcFieldVisibility(entity.content, "name") !== "player_visible") return [];
    const safe = projectEntity(viewer, entity, grants);
    if (!safe) return [];
    const person = publicPerson({ id: safe.id, title: safe.title, content: safe.content });
    return person ? [person] : [];
  });
  return people.sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
}

const privateContexts = ["table-material", "sl-message", "appointment-vote", "live-table", "live-table-signal", "live-table-event"];
export async function loadPublicChronicle(db: D1Database, campaignId: string): Promise<PublicChronicleEntry[]> {
  // Only entries the group can read; draft (sl) and private entries never qualify, whatever their flag says.
  const rows = await db.prepare("SELECT id,title,body FROM records WHERE campaign_id=? AND kind='chronik' AND visibility='group'")
    .bind(campaignId).all<{ id: string; title: string; body: string }>();
  const marked = rows.results.filter(row => {
    const body = parse(row.body);
    return isMarkedForWebsite(body, websiteFlagKeys.chronicle) && !privateContexts.includes(String(body.context));
  });
  if (!marked.length) return [];
  const ids = marked.map(row => row.id);
  const [entities, grants] = await Promise.all([loadEntitiesForIds(db, campaignId, ids), groupGrants(db, campaignId, ids)]);
  const index = new Map(entities.map(entity => [entity.id, entity]));
  const viewer = publicViewer(campaignId);
  return sortPublicChronicle(marked.flatMap(row => {
    const entity = index.get(row.id);
    const safe = entity ? projectEntity(viewer, entity, grants) : null;
    if (!safe) return [];
    const entry = publicChronicleEntry({ id: row.id, title: safe.title }, safe.content);
    return entry ? [entry] : [];
  }));
}

export async function loadPublicWorld(db: D1Database, campaignId: string): Promise<PublicWorld> {
  const [places, people, chronicle] = await Promise.all([
    loadPublicPlaces(db, campaignId), loadPublicPeople(db, campaignId), loadPublicChronicle(db, campaignId),
  ]);
  return { places, people, chronicle };
}

/** SL only: show or hide a main place on the website. Version protected by the node revision, like other node settings. */
export async function setPlaceWebsite(db: D1Database, a: Actor, input: { entityId: string; expectedRevision: number; show: boolean }) {
  requireCmsPublisher(a);
  const node = await getLocationNode(db, a, input.entityId);
  if (node.level !== "location" || node.parent_id !== null || node.location_id !== node.entity_id)
    throw new HttpError(400, "Nur Hauptorte können auf der Website erscheinen.");
  if (node.revision !== input.expectedRevision) throw new HttpError(409, "Der Ort wurde inzwischen geändert. Bitte lade neu.");
  const attributes = { ...parse(node.attributes) };
  if (input.show) attributes[websiteFlagKeys.place] = true; else delete attributes[websiteFlagKeys.place];
  const now = new Date().toISOString();
  const result = await db.batch([
    db.prepare("UPDATE location_nodes SET attributes=?,revision=revision+1,updated_at=? WHERE campaign_id=? AND entity_id=? AND revision=?")
      .bind(JSON.stringify(attributes), now, a.campaignId, input.entityId, input.expectedRevision),
    db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
      SELECT ?,?,?,?,'location.website.changed',?,? WHERE changes()=1`)
      .bind(crypto.randomUUID(), a.campaignId, input.entityId, a.id, JSON.stringify({ show: input.show, expectedRevision: input.expectedRevision }), now),
  ]);
  if (!result[0].meta.changes) throw new HttpError(409, "Der Ort wurde inzwischen geändert. Bitte lade neu.");
  return { ok: true, entityId: input.entityId, showOnWebsite: input.show, revision: input.expectedRevision + 1 };
}
