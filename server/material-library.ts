import type { Actor } from '@/domain/types';
import { materialEntrySchema, materialLibraryLimits, type MaterialCommand, type MaterialEntry, type MaterialEntryView } from '@/domain/material-library';
import { materialElementKind } from '@/domain/material-system';
import { HttpError } from '@/server/database';
import { gmOnly } from '@/server/access';
import { parseObject, type EntityRow } from '@/server/entities';
import { validatePreparationMedia } from './preparation-media';
import { validateSceneMaterials } from './display-assets';

/** Szene 2.0, Etappe 3: material library. One SL-only NOTE entity per material (documentKind scene_material); every
 * write is a compare-and-set on its version with an audit event in the same batch. Players never read this. */
const predicate = "type='NOTE' AND canon_status='GM_SECRET' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='scene_material'";

function decode(row: EntityRow): MaterialEntryView {
  const parsed = materialEntrySchema.safeParse({ ...(parseObject(row.content).document as object || {}), title: row.title });
  if (!parsed.success) throw new HttpError(409, 'Dieses Material enthält einen nicht unterstützten Stand. Vorhandene Daten werden nicht überschrieben.');
  return { id: row.id, version: row.version, updatedAt: row.updated_at, document: parsed.data };
}
export async function readMaterial(db: D1Database, a: Actor, id: string): Promise<MaterialEntryView> {
  gmOnly(a);
  const row = await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id=? AND ${predicate}`).bind(a.campaignId, id).first<EntityRow>();
  if (!row) throw new HttpError(404, 'Material nicht verfügbar.');
  return decode(row);
}
export async function listMaterials(db: D1Database, a: Actor): Promise<{ materials: MaterialEntryView[]; unsupported: string[] }> {
  gmOnly(a);
  const rows = (await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND ${predicate} ORDER BY title,id LIMIT ${materialLibraryLimits.list}`).bind(a.campaignId).all<EntityRow>()).results;
  const materials: MaterialEntryView[] = [], unsupported: string[] = [];
  for (const row of rows) { try { materials.push(decode(row)); } catch { unsupported.push(row.id); } }
  return { materials, unsupported };
}
/** Library entries for scene saves (by id). Unknown or unreadable ids are simply absent. */
export async function materialsByIds(db: D1Database, a: Actor, ids: string[]): Promise<Map<string, MaterialEntry>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return new Map();
  const rows = (await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id IN (${wanted.map(() => '?').join(',')}) AND ${predicate}`).bind(a.campaignId, ...wanted).all<EntityRow>()).results;
  return new Map(rows.flatMap(row => { try { const v = decode(row); return [[v.id, v.document] as const]; } catch { return []; } }));
}

/** Files and display assets are checked like scene material (owner, kind, existence). */
async function validate(db: D1Database, a: Actor, d: MaterialEntry) {
  const element = { id: crypto.randomUUID(), kind: materialElementKind[d.material.type], title: d.title, text: d.text, referenceId: '', fileId: d.material.files[0]?.fileId || '', material: d.material };
  await validatePreparationMedia(db, a, [d.text], d.material.files.map(f => ({ id: f.fileId, kind: element.kind })));
  await validateSceneMaterials(db, a, [element]);
}

export async function executeMaterial(db: D1Database, a: Actor, command: MaterialCommand): Promise<MaterialEntryView> {
  gmOnly(a);
  const create = command.action === 'create', id = create ? 'material-' + command.clientRequestId : command.id;
  const before = create ? null : await readMaterial(db, a, id);
  if (before && command.action === 'save' && before.version !== command.version) throw new HttpError(409, 'Dieses Material wurde inzwischen verändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand.');
  const document = command.document;
  await validate(db, a, document);
  const { title, ...rest } = document;
  const content = JSON.stringify({ documentKind: 'scene_material', canonStatus: 'GM_SECRET', document: rest });
  const now = new Date().toISOString(), version = before ? before.version + 1 : 1;
  const mutation = create
    ? db.prepare(`INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES(?,?,'NOTE','GM_SECRET',?,'sl',?,?,'',1,?,?)`).bind(id, a.campaignId, a.id, title, content, now, now)
    : db.prepare(`UPDATE entities SET title=?,content=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND ${predicate}`).bind(title, content, now, a.campaignId, id, before!.version);
  const event = db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(), a.campaignId, id, a.id, 'command.material.' + (create ? 'created' : 'saved'), JSON.stringify({ version, document }), now);
  const [result] = await db.batch([mutation, event]);
  if (result.meta.changes !== 1) {
    if (create) {
      const prior = await readMaterial(db, a, id).catch(() => null);
      if (prior && prior.version === 1 && JSON.stringify(prior.document) === JSON.stringify(materialEntrySchema.parse(document))) return prior;
    }
    throw new HttpError(409, 'Dieses Material wurde inzwischen verändert. Deine Eingaben bleiben erhalten.');
  }
  return readMaterial(db, a, id);
}
