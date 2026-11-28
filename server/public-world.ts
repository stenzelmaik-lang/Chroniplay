// Öffentliche Welt: the only server path from campaign data to anonymous website visitors.
// Rule: an entry appears on the website only when (1) the SL set its explicit website flag, read from the raw stored
// JSON, and (2) the existing *group* projection already shows it. Content always comes from that projection and is
// then reduced to an allowlist (domain/public-world.ts). The only writers here are SL-only: place flag and intro.
import type { Actor } from "@/domain/types";
import type { Entity } from "@/domain/types";
import type { PlaceProjection } from "@/domain/location-types";
import { LOCATION_MEDIA_KIND, parseLocationItemContent } from "@/domain/location-library";
import { hasNPCFieldVisibility, npcFieldVisibility } from "@/domain/npc-profile";
import {
  isMarkedForWebsite, parsePublicWorldIntro, publicChronicleEntry, publicImageSource, publicPerson, publicPlace, publicRichText,
  publicWorldIntroKey, publicWorldIntroMaxPlain, publicWorldIntroMaxSource, publicWorldLimits, publicWorldOrderHints,
  publicPersonBlockKinds, sortPublicChronicle, websiteFlagKeys,
  type PublicChronicleEntry, type PublicPersonBlock, type PublicImageKind, type PublicPerson, type PublicPlace, type PublicWorld, type PublicWorldIntro,
  type UploadRef,
} from "@/domain/public-world";
import { richTextToPlainText } from "@/domain/location-rich-text";
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

/** One public entry plus the server-only reference to its uploaded image. The list, the image route and the SL overview
 * all use these ordered entries, so the image route can never serve an image the public page would not show. */
type PublicEntry<T> = { item: T; upload: UploadRef | null };
type Ranked<T> = { marked: number; entries: PublicEntry<T>[] };

const rootSql = "SELECT entity_id,attributes FROM location_nodes WHERE campaign_id=? AND level='location' AND parent_id IS NULL AND location_id=entity_id";
function placeEntry(projection: PlaceProjection): PublicEntry<PublicPlace> | null {
  if (projection.view !== "player") return null;
  const item = publicPlace(projection.location);
  return item ? { item, upload: publicImageSource("place", item.id, [projection.location.image]).upload } : null;
}

/** All marked main places the group knows, in the order of the Orte-Werkstatt (position, then ID). Not capped. */
async function rankPublicPlaces(db: D1Database, campaignId: string): Promise<Ranked<PublicPlace>> {
  const roots = await db.prepare(rootSql).bind(campaignId).all<{ entity_id: string; attributes: string }>();
  // The flag is read from the stored attributes: a released place's projection uses its release payload instead.
  const marked = new Set(roots.results.filter(row => isMarkedForWebsite(parse(row.attributes), websiteFlagKeys.place)).map(row => row.entity_id));
  if (!marked.size) return { marked: 0, entries: [] };
  const projections = await loadLocationHub(db, publicViewer(campaignId), "player", "group");
  return { marked: marked.size, entries: projections.flatMap(projection => {
    const entry = marked.has(projection.location.id) ? placeEntry(projection) : null;
    return entry ? [entry] : [];
  }) };
}

function personEntry(viewer: Actor, entity: Entity, grants: GrantRow[], blocks: PublicPersonBlock[]): PublicEntry<PublicPerson> | null {
  if (entity.type !== "NPC" || !isMarkedForWebsite(entity.content, websiteFlagKeys.person)) return null;
  // A person whose name is not released stays anonymous for the group; the website never shows anonymous figures.
  if (hasNPCFieldVisibility(entity.content) && npcFieldVisibility(entity.content, "name") !== "player_visible") return null;
  const safe = projectEntity(viewer, entity, grants);
  if (!safe) return null;
  const item = publicPerson({ id: safe.id, title: safe.title, content: safe.content }, blocks);
  // Field releases are already applied: an unreleased portrait is not in safe.content and yields no upload.
  return item ? { item, upload: publicImageSource("person", item.id, [safe.content.image_primary, safe.content.image]).upload } : null;
}

/** Released narrative blocks (what players read in the dossier), never SL kinds; filtered in SQL. */
async function releasedPersonBlocks(db: D1Database, campaignId: string, ids: string[]) {
  const kinds = [...publicPersonBlockKinds.short, ...publicPersonBlockKinds.biography];
  const map = new Map<string, PublicPersonBlock[]>();
  for (const batch of chunks(ids, 60)) {
    const rows = await db.prepare(`SELECT entity_id,kind,content FROM entity_content_blocks WHERE campaign_id=? AND visibility='player_visible'
      AND kind IN (${kinds.map(() => "?").join(",")}) AND entity_id IN (${batch.map(() => "?").join(",")}) ORDER BY position,id`)
      .bind(campaignId, ...kinds, ...batch).all<{ entity_id: string; kind: string; content: string }>();
    for (const row of rows.results) map.set(row.entity_id, [...(map.get(row.entity_id) ?? []), { kind: row.kind, content: row.content }]);
  }
  return map;
}

/** All marked NPCs the group may see under their name, alphabetical by name. Not capped. */
async function rankPublicPeople(db: D1Database, campaignId: string): Promise<Ranked<PublicPerson>> {
  const rows = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND type='NPC'
    AND json_extract(CASE WHEN json_valid(content) THEN content ELSE '{}' END,'$.${websiteFlagKeys.person}')=1`)
    .bind(campaignId).all<{ id: string }>();
  const ids = rows.results.map(row => row.id);
  if (!ids.length) return { marked: 0, entries: [] };
  const [entities, grants, blocks] = await Promise.all([loadEntitiesForIds(db, campaignId, ids), groupGrants(db, campaignId, ids), releasedPersonBlocks(db, campaignId, ids)]);
  const viewer = publicViewer(campaignId);
  const entries = entities.flatMap(entity => {
    const entry = personEntry(viewer, entity, grants, blocks.get(entity.id) ?? []);
    return entry ? [entry] : [];
  });
  entries.sort((a, b) => a.item.name.localeCompare(b.item.name, "de-DE") || a.item.id.localeCompare(b.item.id));
  return { marked: ids.length, entries };
}

const privateContexts = ["table-material", "sl-message", "appointment-vote", "live-table", "live-table-signal", "live-table-event"];
/** All marked chronicle entries released to the group, newest first. Drafts never qualify. Not capped. */
async function rankPublicChronicle(db: D1Database, campaignId: string): Promise<Ranked<PublicChronicleEntry>> {
  const rows = await db.prepare("SELECT id,title,body,visibility FROM records WHERE campaign_id=? AND kind='chronik'")
    .bind(campaignId).all<{ id: string; title: string; body: string; visibility: string }>();
  const flagged = rows.results.filter(row => {
    const body = parse(row.body);
    return isMarkedForWebsite(body, websiteFlagKeys.chronicle) && !privateContexts.includes(String(body.context));
  });
  const released = flagged.filter(row => row.visibility === "group");
  if (!released.length) return { marked: flagged.length, entries: [] };
  const ids = released.map(row => row.id);
  const [entities, grants] = await Promise.all([loadEntitiesForIds(db, campaignId, ids), groupGrants(db, campaignId, ids)]);
  const index = new Map(entities.map(entity => [entity.id, entity]));
  const viewer = publicViewer(campaignId);
  const items = sortPublicChronicle(released.flatMap(row => {
    const entity = index.get(row.id);
    const safe = entity ? projectEntity(viewer, entity, grants) : null;
    const entry = safe ? publicChronicleEntry({ id: row.id, title: safe.title }, safe.content) : null;
    return entry ? [entry] : [];
  }));
  return { marked: flagged.length, entries: items.map(item => ({ item, upload: null })) };
}

async function readIntro(db: D1Database, campaignId: string): Promise<PublicWorldIntro> {
  const row = await db.prepare("SELECT value FROM settings WHERE key=?").bind(publicWorldIntroKey(campaignId)).first<{ value: string }>();
  return parsePublicWorldIntro(row?.value);
}

const capped = <T,>(ranked: Ranked<T>, limit: number) => ranked.entries.slice(0, limit);

export async function loadPublicWorld(db: D1Database, campaignId: string): Promise<PublicWorld> {
  const [intro, places, people, chronicle] = await Promise.all([
    readIntro(db, campaignId), rankPublicPlaces(db, campaignId), rankPublicPeople(db, campaignId), rankPublicChronicle(db, campaignId),
  ]);
  return {
    // Sanitized on the way out, whatever was stored: no images, no internal links, no protected addresses.
    intro: publicRichText(intro.text),
    places: capped(places, publicWorldLimits.places).map(entry => entry.item),
    people: capped(people, publicWorldLimits.people).map(entry => entry.item),
    chronicle: capped(chronicle, publicWorldLimits.chronicle).map(entry => entry.item),
  };
}

export const publicImageTypes = ["image/jpeg", "image/png", "image/webp"];

/** Image route: the file behind the image of an entry that is on the public page right now (marked, known to the group,
 * within the cap), or null (the route answers 404). A released hero medium of a place is followed to its file here. */
export async function loadPublicImageFile(db: D1Database, campaignId: string, kind: PublicImageKind, id: string) {
  const entries: PublicEntry<PublicPlace | PublicPerson>[] = kind === "place"
    ? capped(await rankPublicPlaces(db, campaignId), publicWorldLimits.places)
    : capped(await rankPublicPeople(db, campaignId), publicWorldLimits.people);
  const upload = entries.find(entry => entry.item.id === id)?.upload;
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

type OverviewSection = { marked: number; limit: number; hint: string; items: { id: string; title: string; shown: boolean }[] };
function overviewSection<T extends { id: string }>(ranked: Ranked<T>, limit: number, hint: string, title: (item: T) => string): OverviewSection {
  return { marked: ranked.marked, limit, hint, items: ranked.entries.map((entry, index) => ({ id: entry.item.id, title: title(entry.item), shown: index < limit })) };
}

/** SL only: what the website shows, what the cap cuts, and how many marked entries the group does not know yet. Built
 * from the same ranked entries as the public page. */
export async function loadPublicWorldOverview(db: D1Database, a: Actor) {
  requireCmsPublisher(a);
  const [intro, places, people, chronicle] = await Promise.all([
    readIntro(db, a.campaignId), rankPublicPlaces(db, a.campaignId), rankPublicPeople(db, a.campaignId), rankPublicChronicle(db, a.campaignId),
  ]);
  return {
    intro: { text: intro.text, version: intro.version, publicText: publicRichText(intro.text) },
    places: overviewSection(places, publicWorldLimits.places, publicWorldOrderHints.places, item => item.title),
    people: overviewSection(people, publicWorldLimits.people, publicWorldOrderHints.people, item => item.name),
    chronicle: overviewSection(chronicle, publicWorldLimits.chronicle, publicWorldOrderHints.chronicle, item => item.title),
  };
}

/** SL only: save the website introduction. Version protected; a stale editor gets a conflict instead of an overwrite. */
export async function savePublicWorldIntro(db: D1Database, a: Actor, input: { text: string; expectedVersion: number }) {
  requireCmsPublisher(a);
  if (input.text.length > publicWorldIntroMaxSource) throw new HttpError(413, "Die Einleitung ist zu lang.");
  if (richTextToPlainText(input.text).length > publicWorldIntroMaxPlain) throw new HttpError(413, `Die Einleitung darf höchstens ${publicWorldIntroMaxPlain} Zeichen lang sein.`);
  const key = publicWorldIntroKey(a.campaignId);
  const current = await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<{ value: string }>();
  const parsed = parsePublicWorldIntro(current?.value);
  if (parsed.version !== input.expectedVersion) throw new HttpError(409, "Die Einleitung wurde inzwischen geändert. Bitte lade neu.");
  const next: PublicWorldIntro = { text: input.text, version: parsed.version + 1, updatedAt: new Date().toISOString() };
  const value = JSON.stringify({ ...next, updatedBy: a.id });
  const result = current
    ? await db.prepare("UPDATE settings SET value=? WHERE key=? AND value=?").bind(value, key, current.value).run()
    : await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING").bind(key, value).run();
  if (result.meta.changes !== 1) throw new HttpError(409, "Die Einleitung wurde inzwischen geändert. Bitte lade neu.");
  return { ok: true, version: next.version, publicText: publicRichText(next.text) };
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
