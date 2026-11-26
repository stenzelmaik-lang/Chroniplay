import type { Actor } from '@/domain/types';
import { executeScene, readScene } from '@/server/story-scenes';
import { database } from '@/server/access';

/** Storyboard 2.0, Phase 4: the live table keeps the play record. When the Regie starts a scene on the table, the
 * scene gets a run for this evening (the existing SceneRun record) and the scene that ran before is completed.
 * Preparation stays untouched; runs live in the scene state. Bookkeeping never blocks the table: the stage change is
 * already committed, so a failure here is reported in the log and the SL can still record the run by hand. */
export async function recordSceneRun(a: Actor, sessionId: string, previousSceneId: string, sceneId: string, label: string) {
  if (!sceneId || previousSceneId === sceneId) return;
  const db = database();
  try {
    if (previousSceneId) {
      const prev = await readScene(db, a, previousSceneId).catch(() => null);
      const open = prev?.state.runs.findLast(run => run.sessionId === sessionId && run.status !== 'completed');
      if (prev && open) await executeScene(db, a, { action: 'complete', id: prev.id, version: prev.version, runId: open.id });
    }
    const scene = await readScene(db, a, sceneId);
    if (scene.state.runs.some(run => run.sessionId === sessionId && run.status !== 'completed')) return;
    const earlier = scene.state.runs.findLast(run => run.sessionId === sessionId && run.status === 'completed');
    // Coming back to a scene of this evening continues its history (reopen), a first visit starts a run.
    if (earlier) await executeScene(db, a, { action: 'reopen', id: scene.id, version: scene.version, runId: earlier.id, newRunId: crypto.randomUUID() });
    else await executeScene(db, a, { action: 'activate', id: scene.id, version: scene.version, runId: crypto.randomUUID(), sessionId, label: label.trim().slice(0, 120) || 'Spielabend', participants: { scope: 'group' } });
  } catch (error) {
    console.warn('Scene run bookkeeping skipped', sceneId, error instanceof Error ? error.message : error);
  }
}
