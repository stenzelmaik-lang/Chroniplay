import { z } from 'zod';
import { validCalendarDate } from './calendar-date.ts';
import { pageFromRow, parseBody, TEXT_LENGTH, type NotebookPage, type NotebookRow } from './notebook.ts';

/** Szene 2.0, Etappe 6: SL notebook. No second notebook: SL notes are the SL's own notebook pages (records of kind
 * 'notizen', private) with references to scenes, NPCs, places and evenings and a kind. They also appear in the SL's
 * normal notebook. Moments recorded at the table ("Festhalten") stay in the play log (one source); the notes area
 * shows them read-only. Pure helpers. */

export const slNoteKinds = ['note', 'idea', 'question', 'promise'] as const;
export type SlNoteKind = typeof slNoteKinds[number];
export const slNoteKindNames: Record<SlNoteKind, string> = { note: 'Notiz', idea: 'Idee', question: 'Offene Frage', promise: 'Versprechen' };
export const slNoteLimits = { refs: 10 } as const;

const refList = z.array(z.string().min(1).max(100)).max(slNoteLimits.refs).default([]).refine(v => new Set(v).size === v.length, 'Ein Bezug darf nur einmal vorkommen.');
export const slNoteRefsSchema = z.object({ sceneIds: refList, npcIds: refList, placeIds: refList, sessionIds: refList }).strict();
export type SlNoteRefs = z.infer<typeof slNoteRefsSchema>;
export const emptyRefs = (): SlNoteRefs => ({ sceneIds: [], npcIds: [], placeIds: [], sessionIds: [] });

export const slNoteCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'), id: z.string().min(1).max(100).optional(), version: z.number().int().positive().optional(),
    title: z.string().max(200).default(''), text: z.string().max(TEXT_LENGTH), date: z.string().refine(validCalendarDate, 'Bitte ein gültiges Datum wählen.'),
    tags: z.array(z.string().max(200)).max(60).default([]), kind: z.enum(slNoteKinds).default('note'), refs: slNoteRefsSchema.default(emptyRefs()),
  }).strict(),
  z.object({ action: z.literal('delete'), id: z.string().min(1).max(100), version: z.number().int().positive() }).strict(),
]);
export type SlNoteCommand = z.infer<typeof slNoteCommandSchema>;

export type SlNote = NotebookPage & { kind: SlNoteKind; refs: SlNoteRefs };

export function readRefs(body: Record<string, unknown>): SlNoteRefs {
  const parsed = slNoteRefsSchema.safeParse(body.slRefs);
  return parsed.success ? parsed.data : emptyRefs();
}
export function slNoteFromRow(row: NotebookRow): SlNote {
  const body = parseBody(row.body);
  return { ...pageFromRow(row), kind: (slNoteKinds as readonly string[]).includes(String(body.slKind)) ? body.slKind as SlNoteKind : 'note', refs: readRefs(body) };
}
/** Body fields of an SL note; everything else in the stored body is kept (the normal notebook may add fields too). */
export function withSlFields(body: Record<string, unknown>, kind: SlNoteKind, refs: SlNoteRefs): Record<string, unknown> {
  const hasRefs = Object.values(refs).some(list => list.length);
  const { slRefs: _r, slKind: _k, ...rest } = body;
  void _r; void _k;
  return { ...rest, ...(kind !== 'note' ? { slKind: kind } : {}), ...(hasRefs ? { slRefs: refs } : {}) };
}

export type SlNoteFilter = Partial<{ sceneId: string; npcId: string; placeId: string; sessionId: string }>;
/** A note matches when it refers to every given reference (no filter = all notes). */
export function noteMatches(note: Pick<SlNote, 'refs'>, f: SlNoteFilter): boolean {
  return (!f.sceneId || note.refs.sceneIds.includes(f.sceneId)) && (!f.npcId || note.refs.npcIds.includes(f.npcId))
    && (!f.placeId || note.refs.placeIds.includes(f.placeId)) && (!f.sessionId || note.refs.sessionIds.includes(f.sessionId));
}
/** Open questions and promises first, then the newest. */
export function sortSlNotes<T extends Pick<SlNote, 'kind' | 'updatedAt'>>(notes: readonly T[]): T[] {
  const weight = (k: SlNoteKind) => k === 'question' || k === 'promise' ? 0 : 1;
  return [...notes].sort((a, b) => weight(a.kind) - weight(b.kind) || b.updatedAt.localeCompare(a.updatedAt));
}
