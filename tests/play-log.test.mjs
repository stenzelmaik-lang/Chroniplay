import test from 'node:test';
import assert from 'node:assert/strict';
import { eveningPlayLog, moveScenesBetweenEvenings } from '../domain/play-log.ts';
import { momentSchema } from '../domain/command-workspace.ts';

const run = (sessionId, startedAt, status = 'completed') => ({ id: crypto.randomUUID(), sessionId, label: 'Abend', participants: { scope: 'group' }, status, startedAt, updatedAt: startedAt, completedAt: status === 'completed' ? startedAt : null, previousRunId: null });
const scene = (id, runs = []) => ({ id, title: id, runs });
const moment = (kind, sceneId, at, sessionId = 'abend') => ({ id: crypto.randomUUID(), kind, text: kind, sessionId, sceneId, occurredAt: at });

test('Plan versus actual: order of play, running, skipped, open and spontaneous scenes', () => {
  const scenes = [
    scene('a', [run('abend', '2026-11-25T19:10:00Z')]),
    scene('b'),
    scene('c', [run('abend', '2026-11-25T19:40:00Z'), run('abend', '2026-11-25T20:30:00Z', 'active')]),
    scene('d'),
    scene('x', [run('abend', '2026-11-25T20:00:00Z')]),
    scene('e', [run('anderer', '2026-11-20T19:00:00Z')]),
  ];
  const moments = [moment('skipped', 'b', '2026-11-25T19:30:00Z'), moment('decision', 'c', '2026-11-25T19:50:00Z'), moment('note', '', '2026-11-25T20:10:00Z'), moment('decision', 'a', '2026-11-20T19:00:00Z', 'anderer')];
  const log = eveningPlayLog('abend', ['a', 'b', 'c', 'd', 'e'], scenes, moments);
  assert.deepEqual(log.played.map(p => p.id), ['a', 'c', 'x'], 'first start decides the order');
  assert.deepEqual(log.played.find(p => p.id === 'c'), { id: 'c', title: 'c', startedAt: '2026-11-25T19:40:00Z', plannedIndex: 2, visits: 2, running: true });
  assert.deepEqual(log.status, { a: 'played', b: 'skipped', c: 'running', d: 'open', e: 'open', x: 'played' });
  assert.deepEqual(log.open, ['d', 'e'], 'runs of other evenings do not count');
  assert.deepEqual(log.skipped, ['b']);
  assert.deepEqual(log.spontaneous, ['x']);
  assert.equal(log.decisions.length, 1);
  assert.equal(log.notes.length, 1);
  assert.equal(log.started, true);
  assert.equal(eveningPlayLog('leer', ['a'], scenes, moments).started, false);
});

test('A skipped scene that is played later counts as played', () => {
  const log = eveningPlayLog('abend', ['a'], [scene('a', [run('abend', '2026-11-25T21:00:00Z')])], [moment('skipped', 'a', '2026-11-25T20:00:00Z')]);
  assert.deepEqual(log.skipped, []);
  assert.equal(log.status.a, 'played');
});

test('Moving unplayed scenes keeps both evenings free of duplicates', () => {
  assert.deepEqual(moveScenesBetweenEvenings(['a', 'b', 'c'], ['x', 'b'], ['b', 'c', 'c']), { from: ['a'], to: ['x', 'b', 'c'] });
  assert.deepEqual(moveScenesBetweenEvenings(['a'], [], []), { from: ['a'], to: [] });
});

test('Moments: old ones stay notes; skipped needs a scene and no run', () => {
  const base = { clientRequestId: crypto.randomUUID(), text: 'x', sessionId: 's', storyId: '', references: [] };
  assert.equal(momentSchema.parse(base).kind, 'note');
  assert.equal(momentSchema.safeParse({ ...base, kind: 'skipped' }).success, false);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'skipped', sceneId: 'scene-1' }).success, true);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'skipped', sceneId: 'scene-1', runId: crypto.randomUUID() }).success, false);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'decision' }).success, true);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'verdict' }).success, false);
});
