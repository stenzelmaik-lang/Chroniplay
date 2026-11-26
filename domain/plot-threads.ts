import { z } from 'zod';

/** Storyboard 2.0, Phase 3: plot threads (Handlungsstränge) that run across evenings and books, with their open strands:
 * clues, secrets, player decisions, promises, prepared consequences and events with time pressure.
 *
 * Platform core (docs/ENTWICKLUNGSGRUNDSATZ.md): no game world, genre or rule system is named here.
 * SL only: a thread is never projected to players. Nothing here reveals, triggers or grants anything; states are the
 * SL's own bookkeeping. Real discovery of clue dossiers stays in the existing knowledge system and is only read. */

export const threadKinds = ['main', 'side', 'personal', 'secret', 'conflict', 'longterm'] as const;
export type ThreadKind = typeof threadKinds[number];
export const threadKindNames: Record<ThreadKind, string> = { main: 'Hauptgeschichte', side: 'Nebenhandlung', personal: 'Persönliche Geschichte', secret: 'Geheimnis', conflict: 'Konflikt', longterm: 'Langzeitereignis' };

export const threadStatuses = ['open', 'active', 'resolved', 'dropped'] as const;
export type ThreadStatus = typeof threadStatuses[number];
export const threadStatusNames: Record<ThreadStatus, string> = { open: 'Offen', active: 'Läuft', resolved: 'Aufgelöst', dropped: 'Fallen gelassen' };

/** Strand kinds and their states. The first state is the start, `done` lists the states that close a strand. */
export const strandKinds = {
  clue: { label: 'Hinweis', states: { hidden: 'Verborgen', planted: 'Ausgelegt', found: 'Gefunden' }, done: ['found'] },
  secret: { label: 'Geheimnis', states: { hidden: 'Verborgen', hinted: 'Angedeutet', revealed: 'Gelüftet' }, done: ['revealed'] },
  decision: { label: 'Entscheidung', states: { made: 'Getroffen' }, done: ['made'] },
  promise: { label: 'Versprechen', states: { open: 'Offen', kept: 'Gehalten', broken: 'Gebrochen' }, done: ['kept', 'broken'] },
  consequence: { label: 'Konsequenz', states: { open: 'Vorgemerkt', applied: 'Eingetreten', dropped: 'Verworfen' }, done: ['applied', 'dropped'] },
  event: { label: 'Ereignis', states: { prepared: 'Vorbereitet', occurred: 'Eingetreten', dropped: 'Verworfen' }, done: ['occurred', 'dropped'] },
} as const satisfies Record<string, { label: string; states: Record<string, string>; done: readonly string[] }>;
export type StrandKind = keyof typeof strandKinds;
export const strandKindList = Object.keys(strandKinds) as StrandKind[];
export const strandHints: Record<StrandKind, string> = {
  clue: 'Was die Runde finden kann. Mit einer Hinweis-Akte verknüpft, zeigt ChroniPlay den echten Entdeckt-Stand.',
  secret: 'Was verborgen bleibt. Nichts wird automatisch gelüftet – du entscheidest.',
  decision: 'Was die Runde entschieden hat. Wird festgehalten, damit spätere Szenen darauf reagieren.',
  promise: 'Zusagen und Verpflichtungen. Formale Schulden zwischen Figuren verwaltest du unter „Gefallen & Schulden“.',
  consequence: 'Was später eintreten soll. Für eine Szene vorgemerkt, erscheint es dort und in der Regie.',
  event: 'Geschieht unabhängig vom Aufenthaltsort der Runde – mit Frist, wenn es drängt. Ob und wann, entscheidest du.',
};

export const threadLimits = { title: 200, summary: 2000, strandTitle: 200, strandText: 3000, deadline: 80, strands: 200, books: 20, refs: 12 } as const;
const id = z.string().min(1).max(100);
const uniqueIds = (max: number) => z.array(id).max(max).refine(v => new Set(v).size === v.length, 'Verknüpfungen dürfen nicht doppelt sein.');

export const strandSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(strandKindList as [StrandKind, ...StrandKind[]]),
  title: z.string().trim().min(1).max(threadLimits.strandTitle),
  text: z.string().max(threadLimits.strandText).default(''),
  state: z.string().max(20),
  /** Dossiers this strand concerns: figures, places, clue or handout dossiers, factions. */
  refIds: uniqueIds(threadLimits.refs).default([]),
  /** Where it was found, decided, or where it is meant to happen ("vorgemerkt für"). */
  sceneId: z.string().max(100).default(''),
  /** In-world deadline as text ("bis Nacht 3"), for events and promises. */
  deadline: z.string().trim().max(threadLimits.deadline).default(''),
}).strict().refine(s => Object.hasOwn(strandKinds[s.kind].states, s.state), 'Dieser Stand passt nicht zur Art des Fadens.');
export type Strand = z.infer<typeof strandSchema>;

export const threadDocumentSchema = z.object({
  title: z.string().trim().min(1).max(threadLimits.title),
  kind: z.enum(threadKinds).default('side'),
  status: z.enum(threadStatuses).default('open'),
  summary: z.string().max(threadLimits.summary).default(''),
  /** Books this thread runs through (it may run through several). Scenes join a thread from the scene (`board.threads`). */
  bookIds: uniqueIds(threadLimits.books).default([]),
  strands: z.array(strandSchema).max(threadLimits.strands).default([])
    .refine(v => new Set(v.map(s => s.id)).size === v.length, 'Fäden benötigen eindeutige IDs.'),
}).strict();
export type ThreadDocument = z.infer<typeof threadDocumentSchema>;
export type ThreadView = { id: string; version: number; updatedAt: string; document: ThreadDocument };
export type ThreadHistory = { id: string; version: number; createdAt: string; document: ThreadDocument };

export const emptyThread = (bookId = ''): ThreadDocument => ({ title: 'Neuer Handlungsstrang', kind: 'side', status: 'open', summary: '', bookIds: bookId ? [bookId] : [], strands: [] });
export function newStrand(kind: StrandKind, title: string, sceneId = ''): Strand {
  return { id: crypto.randomUUID(), kind, title: title.trim().slice(0, threadLimits.strandTitle) || strandKinds[kind].label, text: '', state: Object.keys(strandKinds[kind].states)[0], refIds: [], sceneId, deadline: '' };
}

const revision = z.number().int().min(1);
export const threadCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), clientRequestId: z.string().uuid(), document: threadDocumentSchema }).strict(),
  z.object({ action: z.literal('save'), id, version: revision, document: threadDocumentSchema }).strict(),
  z.object({ action: z.literal('restore'), id, version: revision, historyId: z.string().uuid() }).strict(),
]);
export type ThreadCommand = z.infer<typeof threadCommandSchema>;

export function isStrandOpen(strand: Pick<Strand, 'kind' | 'state'>): boolean {
  return !(strandKinds[strand.kind].done as readonly string[]).includes(strand.state);
}
export function stateName(strand: Pick<Strand, 'kind' | 'state'>): string {
  return (strandKinds[strand.kind].states as Record<string, string>)[strand.state] || strand.state;
}

/** A clue strand linked to a clue dossier shows the real discovery state from the knowledge system (read only). */
export type ClueKnowledge = Record<string, 'known' | 'unknown'>;
export function effectiveClueFound(strand: Strand, knowledge: ClueKnowledge): boolean | null {
  if (strand.kind !== 'clue') return null;
  const linked = strand.refIds.filter(ref => ref in knowledge);
  return linked.length ? linked.some(ref => knowledge[ref] === 'known') : null;
}

export type OpenStrand = { threadId: string; threadTitle: string; strand: Strand; order: number };
/** The open strands across threads, most pressing first: events with a deadline, then consequences and events
 * for a scene that comes up soon (play order), then the rest by thread. Resolved or dropped threads are left out. */
export function openStrands(threads: readonly ThreadView[], sceneOrder: ReadonlyMap<string, number> = new Map()): OpenStrand[] {
  const out: OpenStrand[] = [];
  for (const thread of threads) {
    if (thread.document.status === 'resolved' || thread.document.status === 'dropped') continue;
    for (const strand of thread.document.strands) if (isStrandOpen(strand)) out.push({ threadId: thread.id, threadTitle: thread.document.title, strand, order: 0 });
  }
  const rank = (s: Strand) => {
    if (s.deadline && (s.kind === 'event' || s.kind === 'promise')) return 0;
    if (s.sceneId && sceneOrder.has(s.sceneId)) return 1 + (sceneOrder.get(s.sceneId)! / 100000);
    if (s.kind === 'consequence' || s.kind === 'event') return 3;
    return 4;
  };
  return out.map(item => ({ ...item, order: rank(item.strand) }))
    .sort((a, b) => a.order - b.order || a.threadTitle.localeCompare(b.threadTitle, 'de') || a.strand.title.localeCompare(b.strand.title, 'de'));
}

/** Everything prepared for one scene across all threads (for the scene view and the Regie). Open strands only. */
export function strandsForScene(threads: readonly ThreadView[], sceneId: string): OpenStrand[] {
  return threads.flatMap(thread => thread.document.status === 'dropped' ? [] : thread.document.strands
    .filter(strand => strand.sceneId === sceneId && isStrandOpen(strand))
    .map(strand => ({ threadId: thread.id, threadTitle: thread.document.title, strand, order: 0 })));
}

/** Counts per thread for cards: open strands by kind and the total. */
export function threadCounts(thread: ThreadDocument): { open: number; total: number; byKind: Partial<Record<StrandKind, number>> } {
  const byKind: Partial<Record<StrandKind, number>> = {};
  let open = 0;
  for (const strand of thread.strands) if (isStrandOpen(strand)) { open++; byKind[strand.kind] = (byKind[strand.kind] || 0) + 1; }
  return { open, total: thread.strands.length, byKind };
}

/** Old book possibilities (StoryDocument.possibilities: open, used, discarded) become scene ideas in the book's idea tray,
 * like the old scene branches in Phase 2: open → Idee, used → Spielbereit, discarded → Zurückgestellt. Pure. */
export function bookPossibilityAsScene(p: { title: string; text: string; status: 'open' | 'used' | 'discarded' }): { title: string; board: { status: 'idea' | 'ready' | 'deferred'; premise?: string }; gmNotes: string } {
  const text = p.text.trim(), premise = text.slice(0, 2000);
  const status = p.status === 'used' ? 'ready' : p.status === 'discarded' ? 'deferred' : 'idea';
  return { title: p.title.trim().slice(0, 200) || 'Möglichkeit', board: premise ? { status, premise } : { status }, gmNotes: text.length > 2000 ? '<p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' : '' };
}
