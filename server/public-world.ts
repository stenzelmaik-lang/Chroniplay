// Öffentliche Welt: the only server path from campaign data to anonymous website visitors.
// Rule: an entry appears on the website only when (1) the SL set its explicit website flag, read from the raw stored
// JSON, and (2) the existing *group* projection already shows it. Content always comes from that projection and is
// then reduced to an allowlist (domain/public-world.ts). Nothing here writes, except the SL-only place flag setter.
import type { Actor } from "@/domain/types";
import type { Entity } from "@/domain/types";
import type { PlaceProjection } from "@/domain/location-types";
import { LOCATION_MEDIA_KIND, parseLocationItemContent } from "@/domain/location-library";
import { hasNPCFieldVisibility, npcFieldVisibility } from "@/domain/npc-profile";
import {
  isMarkedForWebsite, publicChronicleEntry, publicImageSource, publicPerson, publicPlace, sortPublicChronicle, websiteFlagKeys,
  type PublicChronicleEntry, type PublicImageKind, type PublicPerson, type PublicPlace, type PublicWorld, type UploadRef,
} from "@/domain/public-world";
import { HttpError } from "@/server/database";
import { loadEntitiesForIds, projectEntity, type GrantRow } from "@/server/entities";
import { getLocationNode, requireCmsPublisher } from "@/server/location-cms-service";
import { loadLocationHub, loadPersistedLocation } from "@/server/location-repository";

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

/** One public entry plus the server-only reference to its uploaded image. The list and the image route both use these,
 * so the image route can never serve an image of an entry the list would not show. */
type PublicEntry<T> = { item: T; upload: UploadRef | null };

const rootSql = "SELECT entity_id,attributes FROM location_nodes WHERE campaign_id=? AND level='location' AND parent_id IS NULL AND location_id=entity_id";
function placeEntry(projection: PlaceProjection | null | undefined): PublicEntry<PublicPlace> | null {
  if (!projection || projection.view !== "player") return null;
  const item = publicPlace(projection.location);
  return item ? { item, upload: publicImageSource("place", item.id, [projection.location.image]).upload } : null;
}

export async function loadPublicPlaces(db: D1Database, campaignId: string): Promise<PublicPlace[]> {
  const roots = await db.prepare(rootSql).bind(campaignId).all<{ entity_id: string; attributes: string }>();
  // The flag is read from the stored attributes: a released place's projection uses its release payload instead.
  const marked = new Set(roots.results.filter(row => isMarkedForWebsite(parse(row.attributes), websiteFlagKeys.place)).map(row => row.entity_id));
  if (!marked.size) return [];
  const projections = await loadLocationHub(db, publicViewer(campaignId), "player", "group");
  return projections.flatMap(projection => {
    const entry = marked.has(projection.location.id) ? placeEntry(projection) : null;
    return entry ? [entry.item] : [];
  });
}

/** Same rule as the list, for a single main place: marked root, group projection, public allowlist. */
async function loadPublicPlaceEntry(db: D1Database, campaignId: string, placeId: string) {
  const root = await db.prepare(rootSql + " AND entity_id=?").bind(campaignId, placeId).first<{ entity_id: string; attributes: string }>();
  if (!root || !isMarkedForWebsite(parse(root.attributes), websiteFlagKeys.place)) return null;
  return placeEntry(await loadPersistedLocation(db, publicViewer(campaignId), placeId, "player", "group"));
}

function personEntry(viewer: Actor, entity: Entity, grants: GrantRow[]): PublicEntry<PublicPerson> | null {
  if (entity.type !== "NPC" || !isMarkedForWebsite(entity.content, websiteFlagKeys.person)) return null;
  // A person whose name is not released stays anonymous for the group; the website never shows anonymous figures.
  if (hasNPCFieldVisibility(entity.content) && npcFieldVisibility(entity.content, "name") !== "player_visible") return null;
  const safe = projectEntity(viewer, entity, grants);
  if (!safe) return null;
  const item = publicPerson({ id: safe.id, title: safe.title, content: safe.content });
  // Field releases are already applied: an unreleased portrait is not in safe.content and yields no upload.
  return item ? { item, upload: publicImageSource("person", item.id, [safe.content.image_primary, safe.content.image]).upload } : null;
}

async function loadPublicPersonEntries(db: D1Database, campaignId: string, onlyId?: string) {
  const rows = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND type='NPC'${onlyId ? " AND id=?" : ""}
    AND json_extract(CASE WHEN json_valid(content) THEN content ELSE '{}' END,'$.${websiteFlagKeys.person}')=1 ORDER BY title,id`)
    .bind(...(onlyId ? [campaignId, onlyId] : [campaignId])).all<{ id: string }>();
  const ids = rows.results.map(row => row.id);
  if (!ids.length) return [];
  const [entities, grants] = await Promise.all([loadEntitiesForIds(db, campaignId, ids), groupGrants(db, campaignId, ids)]);
  const viewer = publicViewer(campaignId);
  return entities.flatMap(entity => {
    const entry = personEntry(viewer, entity, grants);
    return entry ? [entry] : [];
  });
}

export async function loadPublicPeople(db: D1Database, campaignId: string): Promise<PublicPerson[]> {
  return (await loadPublicPersonEntries(db, campaignId)).map(entry => entry.item).sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
}

export const publicImageTypes = ["image/jpeg", "image/png", "image/webp"];

/** Image route: the file behind a public entry's image, or null (the route answers 404). Resolved only through the same
 * entries as the list; a released hero medium of a place is followed to its file here, on the server. */
export async function loadPublicImageFile(db: D1Database, campaignId: string, kind: PublicImageKind, id: string) {
  const entry = kind === "place" ? await loadPublicPlaceEntry(db, campaignId, id) : (await loadPublicPersonEntries(db, campaignId, id))[0] ?? null;
  const upload = entry && entry.item.id === id ? entry.upload : null;
  if (!upload) return null;
  let fileId: string;
  if ("fileId" in upload) fileId = upload.fileId;
  else {
    const block = await db.prepare("SELECT kind,content FROM entity_content_blocks WHERE campaign_id=? AND id=? AND kind=? AND visibility='sl_secret'")
      .bind(campaignId, upload.mediaBlockId, LOCATION_MEDIA_KIND).first<{ kind: string; content: string }>();
    const data = block ? parseLocationItemContent(block.content, block.kind)?.data : null;
    if (!data || !("fileId" in data) || data.state !== "active" || !data.playerReleased || data.mediaType === "sl_plan") return null;
    fileId = data.fileId;
  }
  // Only campaign images that are not a member's private file; SVG and every non-image type are never served.
  const file = await db.prepare("SELECT key,mime,size FROM files WHERE campaign_id=? AND id=? AND visibility IN ('sl','group')")
    .bind(campaignId, fileId).first<{ key: string; mime: string; size: number }>();
  return file && publicImageTypes.includes(file.mime) ? file : null;
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
