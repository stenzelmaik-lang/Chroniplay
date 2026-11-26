import { z } from 'zod';
import { materialElementKind, materialTypes, sceneMaterialSchema, type MaterialType } from './material-system.ts';
import { sceneRichText, type SceneDocument, type SceneElement, type SceneMaterialUse } from './story-scene.ts';

/** Szene 2.0, Etappe 3: the material library. Every material exists once (letters, files, photos, sound, video …) with
 * the Spielmaterial 3.0 block; scenes only use it (`materialUses`). Pager messages stay scene elements (they are
 * messages with recipients) and backdrops belong to the moods, so both are not library types. */
export const libraryMaterialTypes = materialTypes.filter((t): t is Exclude<MaterialType, 'pager' | 'backdrop'> => t !== 'pager' && t !== 'backdrop');
export const materialLibraryLimits = { title: 200, tags: 12, tag: 40, list: 500 } as const;

export const materialEntrySchema = z.object({
  title: z.string().trim().min(1).max(materialLibraryLimits.title),
  /** content of a letter or file, or a description for the SL */
  text: sceneRichText.default(''),
  material: sceneMaterialSchema.refine(m => (libraryMaterialTypes as readonly string[]).includes(m.type), 'Diese Materialart gehört nicht in die Bibliothek.'),
  tags: z.array(z.string().trim().min(1).max(materialLibraryLimits.tag)).max(materialLibraryLimits.tags).default([])
    .refine(v => new Set(v.map(t => t.toLocaleLowerCase('de'))).size === v.length, 'Schlagworte dürfen nicht doppelt sein.'),
  archived: z.boolean().default(false),
}).strict();
export type MaterialEntry = z.infer<typeof materialEntrySchema>;
export type MaterialEntryView = { id: string; version: number; updatedAt: string; document: MaterialEntry };

export const materialCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), clientRequestId: z.string().uuid(), document: materialEntrySchema }).strict(),
  z.object({ action: z.literal('save'), id: z.string().min(1).max(100), version: z.number().int().min(1), document: materialEntrySchema }).strict(),
]);
export type MaterialCommand = z.infer<typeof materialCommandSchema>;

/** The classic element the current Regie plays out for a use. Same id as the use, so table objects stay stable. */
export function elementFromMaterial(use: SceneMaterialUse, entry: MaterialEntry): SceneElement {
  // The library value is only the default for new uses; the use decides.
  const material = { ...entry.material };
  delete material.takeable;
  return {
    id: use.id, kind: materialElementKind[entry.material.type], title: entry.title.slice(0, 200), text: entry.text,
    referenceId: '', fileId: entry.material.files[0]?.fileId || '',
    material: use.takeable ? material : { ...material, takeable: false },
  };
}

/** A library entry from a classic scene element (adopting existing material, on request). */
export function entryFromElement(e: SceneElement): MaterialEntry | null {
  if (!e.material || !(libraryMaterialTypes as readonly string[]).includes(e.material.type) || e.pager || e.check) return null;
  const { takeable, ...material } = e.material;
  return { title: e.title, text: e.text, material: takeable === false ? { ...material, takeable } : material, tags: [], archived: false };
}

const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Mirrors the material uses into classic elements (server side, the library is needed).
 * - every use gets an element with its id, copied from the library (missing library entries keep the stored element);
 * - a classic edit of such an element (element changed, use unchanged) wins: the use is dropped, the element stays a
 *   normal scene element – nothing is lost;
 * - an element that is missing in the incoming document is re-created (not read as a deletion). */
export function withMaterialCopies(doc: SceneDocument, before: SceneDocument | null, library: ReadonlyMap<string, MaterialEntry>): SceneDocument {
  if (!doc.materialUses) return doc;
  const beforeUses = new Map((before?.materialUses || []).map(u => [u.id, u]));
  const beforeEls = new Map((before?.elements || []).map(e => [e.id, e]));
  const incoming = new Map(doc.elements.map(e => [e.id, e]));
  const detached = new Set(doc.materialUses.filter(u => {
    const prior = beforeEls.get(u.id), now = incoming.get(u.id);
    return !!prior && !!now && equal(beforeUses.get(u.id), u) && !equal(prior, now);
  }).map(u => u.id));
  const uses = doc.materialUses.filter(u => !detached.has(u.id));
  const derived = new Map(uses.flatMap(u => {
    const entry = library.get(u.materialId);
    const element = entry ? elementFromMaterial(u, entry) : incoming.get(u.id) || beforeEls.get(u.id);
    return element ? [[u.id, element] as const] : [];
  }));
  const elements = doc.elements.map(e => derived.get(e.id) || e);
  for (const [useId, element] of derived) if (!incoming.has(useId)) elements.push(element);
  return { ...doc, materialUses: uses, elements };
}

/** Rollback aid: older builds reject `materialUses`; the classic elements already hold the material, the use details
 * (how, by whom, condition, audience) move into the SL notes as text. Pure and idempotent. */
export function sceneWithoutMaterialUses(document: Record<string, unknown>): { document: Record<string, unknown>; changed: boolean } {
  if (!('materialUses' in document)) return { document, changed: false };
  const { materialUses, ...rest } = document as Record<string, unknown> & { materialUses?: Record<string, unknown>[] };
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hows: Record<string, string> = { open: 'liegt offen', search: 'durch Untersuchung', handover: 'wird übergeben', other: 'anders' };
  const titles = new Map((Array.isArray(rest.elements) ? rest.elements as { id?: string; title?: string }[] : []).map(e => [e.id, e.title]));
  const lines = (Array.isArray(materialUses) ? materialUses : []).map(u => '<p>Material „' + esc(titles.get(String(u.id)) || u.materialId) + '“: ' + [hows[String(u.how)] || '', u.byNpcId ? 'von ' + esc(u.byNpcId) : '', u.condition ? 'Bedingung: ' + esc(u.condition) : '', u.audience ? 'für: ' + esc(u.audience) : '', u.takeable === false ? 'nicht einsteckbar' : ''].filter(Boolean).join(' · ') + '</p>');
  return { document: lines.length ? { ...rest, gmNotes: String(rest.gmNotes || '') + '<p>Material-Verwendungen (zurückgeführt):</p>' + lines.join('') } : rest, changed: true };
}
