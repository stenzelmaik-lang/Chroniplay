import type { SceneRun } from './story-scene.ts';
import type { MomentKind } from './command-workspace.ts';

/** Storyboard 2.0, Phase 4: plan and actual play of one evening, side by side. Pure.
 * Plan = the evening's scene order (preparation). Actual = scene runs of this evening plus moments (notes, decisions,
 * skipped scenes). Nothing here changes the preparation. */

export type PlayScene = { id: string; title: string; runs: SceneRun[] };
export type PlayMoment = { id: string; kind: MomentKind; text: string; sessionId: string; sceneId: string; occurredAt: string; eventId?: string; eventState?: string };
export type PlayStatus = 'running' | 'played' | 'skipped' | 'open';
export const playStatusNames: Record<PlayStatus, string> = { running: 'Läuft', played: 'Gespielt', skipped: 'Übersprungen', open: 'Nicht gespielt' };

export type PlayLog = {
  /** Scenes in the order they were actually started this evening (first start). */
  played: { id: string; title: string; startedAt: string; plannedIndex: number; visits: number; running: boolean }[];
  status: Record<string, PlayStatus>;
  /** Planned scenes that were neither played nor started: candidates to move to a later evening. */
  open: string[];
  skipped: string[];
  /** Played scenes that were not in the plan (spontaneous). */
  spontaneous: string[];
  decisions: PlayMoment[];
  notes: PlayMoment[];
  /** Szene 2.0, Etappe 4: what happened with prepared events */
  events: PlayMoment[];
  started: boolean;
};

export function eveningPlayLog(sessionId: string, plannedIds: readonly string[], scenes: readonly PlayScene[], moments: readonly PlayMoment[]): PlayLog {
  const byId = new Map(scenes.map(scene => [scene.id, scene]));
  const played = scenes.flatMap(scene => {
    const runs = scene.runs.filter(run => run.sessionId === sessionId);
    if (!runs.length) return [];
    const first = runs.reduce((a, b) => a.startedAt <= b.startedAt ? a : b);
    return [{ id: scene.id, title: scene.title, startedAt: first.startedAt, plannedIndex: plannedIds.indexOf(scene.id), visits: runs.length, running: runs.some(run => run.status !== 'completed') }];
  }).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const evening = moments.filter(m => m.sessionId === sessionId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const playedIds = new Set(played.map(p => p.id));
  // A skip only counts while the scene was not played afterwards (the SL may change her mind at the table).
  const skipped = [...new Set(evening.filter(m => m.kind === 'skipped' && m.sceneId && !playedIds.has(m.sceneId)).map(m => m.sceneId))];
  const status: Record<string, PlayStatus> = {};
  for (const id of plannedIds) status[id] = 'open';
  for (const id of skipped) status[id] = 'skipped';
  for (const p of played) status[p.id] = p.running ? 'running' : 'played';
  return {
    played, status,
    open: plannedIds.filter(id => status[id] === 'open' && byId.has(id)),
    skipped,
    spontaneous: played.filter(p => p.plannedIndex < 0).map(p => p.id),
    decisions: evening.filter(m => m.kind === 'decision'),
    notes: evening.filter(m => m.kind === 'note'),
    events: evening.filter(m => m.kind === 'event'),
    started: played.length > 0 || evening.length > 0,
  };
}

/** Moves scene ids from one evening to the end of another; both lists stay free of duplicates. Pure. */
export function moveScenesBetweenEvenings(from: readonly string[], to: readonly string[], ids: readonly string[]): { from: string[]; to: string[] } {
  const moving = new Set(ids);
  return { from: from.filter(id => !moving.has(id)), to: [...to.filter(id => !moving.has(id)), ...ids.filter((id, i) => ids.indexOf(id) === i)] };
}
