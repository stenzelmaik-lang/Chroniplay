import { z } from 'zod';

/** Storyboard 2.0, Phase 1: block types, optional scene properties and a preparation status the SL sets herself.
 * Platform core (docs/ENTWICKLUNGSGRUNDSATZ.md): nothing here names a game world, genre or rule system.
 * Everything is optional; a scene without `board` behaves exactly as before (regular scene, derived status).
 * Preparation only: nothing here records or triggers play. Runs stay in the scene state. */

/** The eight preparation areas of a scene, in guide order (same ids as sceneGuideSteps). */
export const boardAreas = ['narration', 'atmosphere', 'dialogueNotes', 'interactions', 'secrets', 'visions', 'possibleConsequences', 'gmNotes'] as const;
export type BoardArea = typeof boardAreas[number];

export const boardBlockKinds = ['scene', 'optional', 'free-play', 'decision', 'council', 'transition', 'encounter', 'event', 'gathering', 'note'] as const;
export type BoardBlockKind = typeof boardBlockKinds[number];

/** Which areas a block type offers by default. Filled areas always stay visible, and "Weitere Bereiche" shows all. */
export const boardBlockTypes: Record<BoardBlockKind, { label: string; hint: string; areas: readonly BoardArea[] }> = {
  scene: { label: 'Reguläre Szene', hint: 'Eine vollständig vorbereitete Szene mit allen Bereichen.', areas: boardAreas },
  optional: { label: 'Optionale Szene', hint: 'Kann gespielt werden, muss aber nicht.', areas: boardAreas },
  'free-play': { label: 'Freies Spiel', hint: 'Die Runde handelt frei. Du hältst nur Stimmung, Figuren und Möglichkeiten bereit.', areas: ['atmosphere', 'dialogueNotes', 'interactions', 'secrets', 'gmNotes'] },
  decision: { label: 'Entscheidungspunkt', hint: 'Die Runde entscheidet. Du hältst Ausgangslage und mögliche Folgen fest.', areas: ['narration', 'secrets', 'possibleConsequences', 'gmNotes'] },
  council: { label: 'Beratung und Auswertung', hint: 'Die Runde bespricht, was sie weiß, und plant den nächsten Schritt.', areas: ['narration', 'possibleConsequences', 'gmNotes'] },
  transition: { label: 'Übergang', hint: 'Verbindet zwei Szenen: Ortswechsel, Zeitsprung, kurze Erzählung.', areas: ['narration', 'atmosphere', 'gmNotes'] },
  encounter: { label: 'Begegnung', hint: 'Eine Begegnung mit Figuren, offen in Gespräch oder Konflikt.', areas: ['narration', 'atmosphere', 'dialogueNotes', 'interactions', 'possibleConsequences', 'gmNotes'] },
  event: { label: 'Ereignis', hint: 'Etwas geschieht, unabhängig davon, wo die Runde gerade ist. Du entscheidest, ob und wann.', areas: ['narration', 'secrets', 'visions', 'possibleConsequences', 'gmNotes'] },
  gathering: { label: 'Sammelpunkt', hint: 'Getrennte Wege laufen hier wieder zusammen.', areas: ['narration', 'possibleConsequences', 'gmNotes'] },
  note: { label: 'Platzhalter und kreative Notiz', hint: 'Ein Merkzettel im Ablauf. Ausarbeiten kannst du ihn später.', areas: ['gmNotes'] },
};

export const boardStatuses = ['idea', 'working', 'review', 'ready', 'deferred'] as const;
export type BoardStatus = typeof boardStatuses[number];
export const boardStatusNames: Record<BoardStatus, string> = { idea: 'Idee', working: 'In Ausarbeitung', review: 'Prüfung erforderlich', ready: 'Spielbereit', deferred: 'Zurückgestellt' };

export const boardPriorities = ['low', 'normal', 'high'] as const;
export const boardPriorityNames: Record<typeof boardPriorities[number], string> = { low: 'Niedrig', normal: 'Normal', high: 'Hoch' };
export const boardPlotNames = { main: 'Haupthandlung', side: 'Nebenhandlung' } as const;

export const boardTextMax = 2000;
/** Phase 2: connections between scenes. Orientation only; nothing enforces an order or blocks the SL. */
export const boardLinkKinds = ['next', 'branch', 'optional', 'return'] as const;
export type BoardLinkKind = typeof boardLinkKinds[number];
export const boardLinkKindNames: Record<BoardLinkKind, string> = { next: 'Weiter', branch: 'Alternative', optional: 'Optionaler Zweig', return: 'Rückkehr' };
export const boardLinkMax = 20;
export const boardLinkTextMax = 200;
export const boardLaneMax = 60;
export const boardThreadMax = 10;
export const boardTimeLabelMax = 80;
export const boardLinkSchema = z.object({
  id: z.string().uuid(),
  to: z.string().min(1).max(100),
  kind: z.enum(boardLinkKinds).default('next'),
  label: z.string().trim().max(boardLinkTextMax).default(''),
  condition: z.string().trim().max(boardLinkTextMax).default(''),
}).strict();
export type BoardLink = z.infer<typeof boardLinkSchema>;
export const boardMinutesMax = 600;
const shortText = z.string().max(boardTextMax).default('');

/** Optional storyboard properties of a scene. Every field may be left out; unknown keys are rejected like the rest of the scene. */
export const sceneBoardSchema = z.object({
  kind: z.enum(boardBlockKinds).optional(),
  status: z.enum(boardStatuses).optional(),
  premise: shortText.optional(),
  plot: z.enum(['main', 'side']).optional(),
  optional: z.boolean().optional(),
  triggers: shortText.optional(),
  minutes: z.number().int().min(1).max(boardMinutesMax).optional(),
  priority: z.enum(boardPriorities).optional(),
  // Phase 2 (optional): connections, in-world time and a lane for parallel action of several groups.
  links: z.array(boardLinkSchema).max(boardLinkMax)
    .refine(v => new Set(v.map(l => l.id)).size === v.length, 'Verbindungen benötigen eindeutige IDs.')
    .refine(v => new Set(v.map(l => l.to)).size === v.length, 'Eine Szene darf nur einmal als Ziel verbunden sein.').optional(),
  timeLabel: z.string().trim().max(boardTimeLabelMax).optional(),
  timeOrder: z.number().int().min(-100000).max(100000).optional(),
  lane: z.string().trim().max(boardLaneMax).optional(),
  // Phase 3 (optional): plot threads this scene belongs to (ids of plot_thread dossiers). The lane stays the player group.
  threads: z.array(z.string().min(1).max(100)).max(boardThreadMax)
    .refine(v => new Set(v).size === v.length, 'Ein Handlungsstrang darf nur einmal zugeordnet sein.').optional(),
}).strict();
export type SceneBoard = z.infer<typeof sceneBoardSchema>;

export function boardKind(board: SceneBoard | undefined): BoardBlockKind {
  return board?.kind || 'scene';
}

/** Areas offered for a scene: those of its type plus every area that already holds content (nothing gets hidden). */
export function visibleBoardAreas(board: SceneBoard | undefined, filled: (area: BoardArea) => boolean, showAll = false): BoardArea[] {
  if (showAll) return [...boardAreas];
  const own = new Set<BoardArea>(boardBlockTypes[boardKind(board)].areas);
  return boardAreas.filter(area => own.has(area) || filled(area));
}

/** The status the SL set; without one, the old derived readiness stands in (idea → Idee, draft → In Ausarbeitung, ready → Spielbereit). */
export function boardStatus(board: SceneBoard | undefined, derived: 'idea' | 'draft' | 'ready'): BoardStatus {
  if (board?.status) return board.status;
  return derived === 'draft' ? 'working' : derived;
}

/** Optional is a property, and "Optionale Szene" a type; either marks the card. */
export function isOptionalBlock(board: SceneBoard | undefined): boolean {
  return board?.optional === true || board?.kind === 'optional';
}

/** Sum of the estimated minutes; `estimated` counts how many scenes carry an estimate. Deferred scenes are left out. */
export function boardDuration(boards: readonly (SceneBoard | undefined)[]): { minutes: number; estimated: number } {
  let minutes = 0, estimated = 0;
  for (const board of boards) if (board?.minutes && board.status !== 'deferred') { minutes += board.minutes; estimated++; }
  return { minutes, estimated };
}

export function formatMinutes(total: number): string {
  if (total < 60) return total + ' Min.';
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

/** Drops empty values, so an untouched board is not stored at all. */
export function compactBoard(board: SceneBoard): SceneBoard | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(board)) {
    if (value === undefined || value === '' || value === false || Array.isArray(value) && !value.length) continue;
    if (key === 'kind' && value === 'scene') continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out as SceneBoard : undefined;
}

/** Converts an old free-text branch (scene `possibilities`) into the new system: a scene idea of its own plus a
 * connection from the source scene. Pure: the caller creates the scene and saves both documents. Nothing is lost:
 * the title becomes the scene title and the connection label, the text becomes the rough idea (and SL notes if long). */
export function possibilityAsScene(possibility: { title: string; text: string }, storyId: string): { title: string; storyId: string; board: SceneBoard; gmNotes: string } {
  const text = possibility.text.trim();
  const premise = text.length <= boardTextMax ? text : text.slice(0, boardTextMax - 1) + '…';
  return {
    title: possibility.title.trim().slice(0, 200) || 'Abzweigung',
    storyId,
    board: compactBoard({ status: 'idea', premise }) || {},
    gmNotes: text.length > boardTextMax ? '<p>' + esc(text) + '</p>' : '',
  };
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rollback aid (Storyboard 2.0 release): an older build parses scenes strictly and would reject `board`.
 * Moves every value into the private SL notes as text and removes the key. Nothing is lost. Pure and idempotent. */
export function sceneWithoutBoard(document: Record<string, unknown>): { document: Record<string, unknown>; changed: boolean } {
  if (!('board' in document)) return { document, changed: false };
  const { board, ...rest } = document as Record<string, unknown> & { board?: Partial<SceneBoard> | null };
  const b = board && typeof board === 'object' ? board : {};
  const parts = [
    b.kind && 'Typ: ' + esc(boardBlockTypes[b.kind as BoardBlockKind]?.label || b.kind),
    b.status && 'Status: ' + esc(boardStatusNames[b.status as BoardStatus] || b.status),
    b.plot && esc(boardPlotNames[b.plot as 'main' | 'side'] || b.plot),
    b.optional && 'optional',
    b.minutes && 'Dauer: ' + esc(b.minutes) + ' Min.',
    b.priority && 'Priorität: ' + esc(boardPriorityNames[b.priority as 'low' | 'normal' | 'high'] || b.priority),
    b.timeLabel && 'Zeit: ' + esc(b.timeLabel),
    typeof b.timeOrder === 'number' && 'Zeitfolge: ' + esc(b.timeOrder),
    b.lane && 'Spur: ' + esc(b.lane),
    Array.isArray(b.threads) && b.threads.length && 'Handlungsstränge: ' + esc(b.threads.join(', ')),
  ].filter(Boolean);
  const links = Array.isArray(b.links) ? b.links.map(l => '<li>' + esc(boardLinkKindNames[l.kind as BoardLinkKind] || l.kind) + ' → ' + esc(l.to) + (l.label ? ' · ' + esc(l.label) : '') + (l.condition ? ' · wenn: ' + esc(l.condition) : '') + '</li>') : [];
  const texts = ([['premise', 'Grobe Idee'], ['triggers', 'Voraussetzungen und Auslöser']] as const)
    .flatMap(([key, label]) => b[key] ? ['<p>' + label + ': ' + esc(b[key]) + '</p>'] : []);
  const linkNote = links.length ? '<p>Verbindungen:</p><ul>' + links.join('') + '</ul>' : '';
  const note = parts.length || texts.length || links.length ? '<p>Storyboard (zurückgeführt): ' + (parts.join(' · ') || 'ohne Eigenschaften') + '</p>' + texts.join('') + linkNote : '';
  return { document: note ? { ...rest, gmNotes: String(rest.gmNotes || '') + note } : rest, changed: true };
}
