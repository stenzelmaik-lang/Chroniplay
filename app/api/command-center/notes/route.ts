import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from "@/server/access";
import { isRichTextWithinLimit } from "@/domain/location-rich-text";
import { applyPageEdit, isNotebookRow, normalizeTags, parseBody, TEXT_LENGTH, type NotebookRow } from "@/domain/notebook";
import { noteMatches, readRefs, slNoteCommandSchema, slNoteFromRow, sortSlNotes, withSlFields, type SlNoteRefs } from "@/domain/sl-notes";
import { loadEntitiesForIds } from "@/server/entities";
import { validateCommandReferences } from "@/server/command-workspace";
import type { Actor } from "@/domain/types";
export const dynamic = "force-dynamic";

/** Szene 2.0, Etappe 6: SL notebook. The SL's own notebook pages (records 'notizen', private) with references to
 * scenes, NPCs, places and evenings. SL only; players never read these (their notebook route only lists own pages). */
const sceneWhere = "type='SCENE' AND canon_status='WORKING' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='story_scene'";

async function ownRows(db: D1Database, a: Actor) {
  const rows = await db.prepare("SELECT id,owner_id,title,visibility,body,version,created_at,updated_at FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' ORDER BY updated_at DESC LIMIT 2000").bind(a.campaignId, a.id).all<NotebookRow>();
  return rows.results.filter(row => isNotebookRow(row, a.id));
}
/** New references must exist and fit; references already stored may stay when their target disappears later. */
async function validateRefs(db: D1Database, a: Actor, refs: SlNoteRefs, kept: SlNoteRefs) {
  const fresh = (list: string[], old: string[]) => list.filter(id => !old.includes(id));
  const scenes = fresh(refs.sceneIds, kept.sceneIds), npcs = fresh(refs.npcIds, kept.npcIds), places = fresh(refs.placeIds, kept.placeIds), sessions = fresh(refs.sessionIds, kept.sessionIds);
  if (scenes.length) {
    const found = await db.prepare(`SELECT id FROM entities WHERE campaign_id=? AND id IN (${scenes.map(() => "?").join(",")}) AND ${sceneWhere}`).bind(a.campaignId, ...scenes).all<{ id: string }>();
    if (found.results.length !== scenes.length) throw new HttpError(400, "Eine bezogene Szene ist nicht verfügbar.");
  }
  if (npcs.length || places.length) {
    await validateCommandReferences(db, a, [...npcs, ...places]);
    const entities = await loadEntitiesForIds(db, a.campaignId, [...npcs, ...places]);
    if (npcs.some(id => entities.find(e => e.id === id)?.type !== "NPC") || places.some(id => entities.find(e => e.id === id)?.type !== "PLACE")) throw new HttpError(400, "Ein Bezug passt nicht: Figuren sind NSC-Akten, Orte sind Orte.");
  }
  for (const sid of sessions) if (!await db.prepare("SELECT id FROM records WHERE campaign_id=? AND id=? AND kind='sitzungen'").bind(a.campaignId, sid).first()) throw new HttpError(400, "Ein bezogener Spielabend ist nicht verfügbar.");
}

export async function GET(req: Request) {
  try {
    const a = await actor(); gmOnly(a);
    const q = new URL(req.url).searchParams;
    const filter = { sceneId: q.get("sceneId") || undefined, npcId: q.get("npcId") || undefined, placeId: q.get("placeId") || undefined, sessionId: q.get("sessionId") || undefined };
    const notes = (await ownRows(database(), a)).map(slNoteFromRow).filter(n => noteMatches(n, filter));
    return json({ notes: sortSlNotes(notes) });
  } catch (e) { return failure(e, req); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(); gmOnly(a);
    const db = database(), parsed = slNoteCommandSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data, now = new Date().toISOString();
    const existing = d.id ? await db.prepare("SELECT id,owner_id,title,visibility,body,version,created_at,updated_at FROM records WHERE id=? AND campaign_id=? AND kind='notizen'").bind(d.id, a.campaignId).first<NotebookRow>() : null;
    if (d.id && (!existing || !isNotebookRow(existing, a.id))) throw new HttpError(404, "Diese Notiz gibt es in deinem Notizbuch nicht.");
    if (d.action === "delete") {
      // Character pages are archived, never deleted; that stays the job of the normal notebook.
      if (slNoteFromRow(existing!).deletion === "archive") throw new HttpError(400, "Diese Seite gehört zu einer Figur. Archiviere sie im Notizbuch.");
      const result = await db.prepare("DELETE FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND version=?").bind(existing!.id, a.campaignId, a.id, d.version).run();
      if (!result.meta.changes) throw new HttpError(409, "Die Notiz wurde inzwischen geändert. Lade neu.");
      return json({ ok: true });
    }
    const tags = normalizeTags(d.tags);
    if (tags.error) throw new HttpError(400, tags.error);
    if (d.text.startsWith("cvk-rich-v1:") ? !isRichTextWithinLimit(d.text, 30000) : d.text.trim().length > TEXT_LENGTH) throw new HttpError(413, "Der Text ist zu lang.");
    await validateRefs(db, a, d.refs, existing ? readRefs(parseBody(existing.body)) : { sceneIds: [], npcIds: [], placeIds: [], sessionIds: [] });
    const edit = { title: d.title, text: d.text, date: d.date, tags: tags.tags };
    if (existing) {
      if (!d.version) throw new HttpError(400, "Die Version der Notiz fehlt.");
      const next = applyPageEdit(parseBody(existing.body), edit), body = JSON.stringify(withSlFields(next.body, d.kind, d.refs));
      if (body.length > 100000) throw new HttpError(413, "Der Text ist zu lang.");
      const result = await db.prepare("UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND version=?").bind(next.title, body, now, existing.id, a.campaignId, a.id, d.version).run();
      if (!result.meta.changes) throw new HttpError(409, "Diese Notiz wurde inzwischen an anderer Stelle geändert. Dein Entwurf bleibt erhalten.");
      return json({ note: slNoteFromRow({ ...existing, title: next.title, body, version: existing.version + 1, updated_at: now }) });
    }
    if (!d.text.trim() && !d.title.trim()) throw new HttpError(400, "Eine leere Notiz wird nicht gespeichert.");
    const next = applyPageEdit({}, edit), id = crypto.randomUUID(), body = JSON.stringify(withSlFields(next.body, d.kind, d.refs));
    if (body.length > 100000) throw new HttpError(413, "Der Text ist zu lang.");
    await db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) VALUES(?,?,'notizen','private',?,?,'',?,?,?)").bind(id, a.id, next.title, body, now, now, a.campaignId).run();
    return json({ note: slNoteFromRow({ id, owner_id: a.id, title: next.title, visibility: "private", body, version: 1, created_at: now, updated_at: now }) }, 201);
  } catch (e) { return failure(e, req); }
}
