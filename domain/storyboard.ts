import type { SceneSummary } from './story-scene.ts';
import type { PreparedSession } from './story-preparation.ts';
import { orderedSessionScenes } from './session-overview.ts';

/** Storyboard (Kommandozentrum → Spielabend vorbereiten): Chronik → Buch → Spielabend → Szene.
 * Pure helpers only; nothing here persists or changes a status. Readiness is derived from the
 * scene content the SL already wrote and is only a hint, never a gate. */

export type SceneReadiness = 'idea' | 'draft' | 'ready';
export const sceneReadinessNames: Record<SceneReadiness, string> = { idea: 'Idee', draft: 'Im Entwurf', ready: 'Spielbereit' };

/** idea: no read-aloud text yet · draft: read-aloud text, but no private notes or people/media · ready: text plus SL preparation. */
export function sceneReadiness(scene: Pick<SceneSummary, 'preparation'>): SceneReadiness {
  const p = scene.preparation;
  if (!p || !p.narrationExcerpt) return 'idea';
  const backing = p.sections.some(key => key !== 'narration') || p.npcIds.length > 0 || p.materials.length > 0 || p.embeddedFileIds.length > 0;
  return backing ? 'ready' : 'draft';
}

/** Moves one id to a new index; unknown ids or targets return the list unchanged (new array). */
export function moveId(ids: readonly string[], id: string, toIndex: number): string[] {
  const from = ids.indexOf(id);
  const next = [...ids];
  if (from < 0) return next;
  const target = Math.max(0, Math.min(ids.length - 1, Math.trunc(toIndex)));
  if (target === from) return next;
  next.splice(from, 1);
  next.splice(target, 0, id);
  return next;
}

/** New session sceneIds after reordering the visible evening: visible order first, then
 * ids that stay linked but are currently unavailable (never dropped). */
export function reorderedSessionSceneIds(sessionId: string, session: PreparedSession['document'], scenes: SceneSummary[], id: string, toIndex: number): string[] {
  const visible = orderedSessionScenes(sessionId, session, scenes).map(scene => scene.id);
  const moved = moveId(visible, id, toIndex);
  return [...moved, ...session.sceneIds.filter(existing => !moved.includes(existing))];
}

/** Evenings of a book by actual ids (session.storyIds or a scene of this book); never by title. */
export function bookEvenings(storyId: string, sessions: PreparedSession[], scenes: SceneSummary[]): PreparedSession[] {
  return sessions.filter(session => session.document.status !== 'archived' && (
    session.document.storyIds.includes(storyId) ||
    orderedSessionScenes(session.id, session.document, scenes).some(scene => scene.storyId === storyId)));
}

/** Evenings that belong to no book yet. */
export function looseEvenings(storyIds: string[], sessions: PreparedSession[], scenes: SceneSummary[]): PreparedSession[] {
  return sessions.filter(session => session.document.status !== 'archived' && !storyIds.some(id => bookEvenings(id, [session], scenes).length));
}

/** Scenes of the book that are planned for no evening yet: the "Ideenablage". */
export function unplacedBookScenes(storyId: string, sessions: PreparedSession[], scenes: SceneSummary[]): SceneSummary[] {
  const placed = new Set(sessions.flatMap(session => orderedSessionScenes(session.id, session.document, scenes).map(scene => scene.id)));
  return scenes.filter(scene => !scene.archived && scene.storyId === storyId && !placed.has(scene.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'de') || a.id.localeCompare(b.id));
}

export type EveningProgress = { total: number; idea: number; draft: number; ready: number };
export function eveningProgress(sessionId: string, session: PreparedSession['document'], scenes: SceneSummary[]): EveningProgress {
  const list = orderedSessionScenes(sessionId, session, scenes);
  const out: EveningProgress = { total: list.length, idea: 0, draft: 0, ready: 0 };
  for (const scene of list) out[sceneReadiness(scene)]++;
  return out;
}

/** Guided entry. Each step is a suggestion derived from the data; the SL may skip any of them. */
export type GuideStepId = 'book' | 'evening' | 'sketch' | 'elaborate' | 'ready';
export const storyboardGuide: { id: GuideStepId; label: string; hint: string }[] = [
  { id: 'book', label: 'Buch wählen', hint: 'Wähle das Buch oder die Kampagne, an der du arbeitest, oder lege ein neues an.' },
  { id: 'evening', label: 'Spielabend anlegen', hint: 'Ein Spielabend bündelt die Szenen, die du an einem Abend spielen willst.' },
  { id: 'sketch', label: 'Szenen skizzieren', hint: 'Halte jede Szene zuerst als grobe Idee fest – ein Titel und ein Satz reichen.' },
  { id: 'elaborate', label: 'Ausarbeiten', hint: 'Öffne eine Szene und arbeite ihre acht Bereiche aus – von der Erzählung bis zu den SL-Notizen. Leere Bereiche darfst du überspringen.' },
  { id: 'ready', label: 'Spielbereit', hint: 'Alle Szenen haben Vorlesetext und Vorbereitung. Gespielt wird über die Live-Regie.' },
];

export function guideState(input: { bookId: string; eveningId: string; progress: EveningProgress | null }): Record<GuideStepId, boolean> {
  const p = input.progress;
  return {
    book: !!input.bookId,
    evening: !!input.eveningId,
    sketch: !!p && p.total > 0,
    elaborate: !!p && p.total > 0 && p.idea === 0,
    ready: !!p && p.total > 0 && p.ready === p.total,
  };
}

const materialKindNames: Record<string, string> = { audio: 'Audio', image: 'Bild', handout: 'Handout', video: 'Video', check: 'Probe' };

/** People and play material of one scene for the evening run-through, with the same rules as the
 * classic evening overview: persons linked as material count as Mitwirkende, places are not material,
 * images embedded in texts are listed once, linked clues follow. Names are looked up, never stored. */
export function sceneResources(scene: Pick<SceneSummary, 'preparation'>, names: ReadonlyMap<string, string>, fileNames: ReadonlyMap<string, string>) {
  const p = scene.preparation;
  if (!p) return { people: [] as string[], materials: [] as string[] };
  const peopleIds = [...new Set([...p.npcIds, ...p.materials.filter(m => m.kind === 'person' && m.referenceId).map(m => m.referenceId as string)])];
  const items = p.materials.filter(m => m.kind !== 'person' && m.kind !== 'place');
  const embedded = p.embeddedFileIds.filter(id => !items.some(item => item.fileId === id));
  return {
    people: peopleIds.map(id => names.get(id) || 'Verknüpfte Person nicht verfügbar'),
    materials: [
      ...items.map(m => (materialKindNames[m.kind] || 'Material') + ': ' + (m.title || (m.fileId ? fileNames.get(m.fileId) : '') || 'Ohne Titel')),
      ...embedded.map(id => 'Bild: ' + (fileNames.get(id) || 'Datei nicht verfügbar')),
      ...p.clueIds.map(id => 'Hinweis: ' + (names.get(id) || 'nicht verfügbar')),
    ],
  };
}

/** Evenings in play order: Spielabend 1 first. Planned dates lead (earliest first), undated evenings
 * follow in natural title order ("Spielabend 2" before "Spielabend 10"). */
export function sortEvenings(sessions: PreparedSession[]): PreparedSession[] {
  return [...sessions].sort((a, b) => {
    const da = a.document.date, db = b.document.date;
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (!!da !== !!db) return da ? -1 : 1;
    return a.document.title.localeCompare(b.document.title, 'de', { numeric: true }) || a.id.localeCompare(b.id);
  });
}
