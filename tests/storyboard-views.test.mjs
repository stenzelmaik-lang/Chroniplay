import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { compactBoard, sceneWithoutBoard } from '../domain/storyboard-blocks.ts';
import { plotGraph, plotTimeline, sharedLane } from '../domain/storyboard-views.ts';

const uuid = () => crypto.randomUUID();
const link = (to, kind = 'next', over = {}) => ({ id: uuid(), to, kind, label: '', condition: '', ...over });
const s = (id, board) => ({ id, title: id, board });

test('Links, time and lane are optional, validated and stored compactly', () => {
  const board = { links: [link('scene-b', 'branch', { label: 'Wenn sie fliehen', condition: 'Probe misslungen' })], timeLabel: 'Nacht 1, 23 Uhr', timeOrder: 10, lane: 'Gruppe A' };
  assert.deepEqual(sceneDocumentSchema.parse({ ...emptyScene(), board }).board, board);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { links: [link('x'), link('x')] } }).success, false, 'one target once');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { links: [{ ...link('x'), kind: 'zwang' }] } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { links: Array.from({ length: 21 }, (_, i) => link('s' + i)) } }).success, false);
  assert.equal(compactBoard({ links: [], lane: '' }), undefined, 'empty lists are not stored');
});

test('Rollback keeps links, time and lane as text in the SL notes', () => {
  const doc = sceneDocumentSchema.parse({ ...emptyScene(), board: { links: [link('scene-b', 'return', { label: 'Zurück <Hafen>', condition: 'nach dem Kampf' })], timeLabel: 'Nacht 2', timeOrder: 3, lane: 'Gruppe B' } });
  const { document } = sceneWithoutBoard(doc);
  assert.match(document.gmNotes, /Zeit: Nacht 2 · Zeitfolge: 3 · Spur: Gruppe B/);
  assert.match(document.gmNotes, /Rückkehr → scene-b · Zurück &lt;Hafen&gt; · wenn: nach dem Kampf/);
  assert.equal(sceneDocumentSchema.safeParse(document).success, true, 'list markup is accepted by the rich text');
});

test('Plot network: branches spread right, merges wait for the furthest predecessor, order decides rows', () => {
  const scenes = [
    s('start', { links: [link('a'), link('b', 'branch')] }),
    s('a', { links: [link('end')] }),
    s('b', { links: [link('b2')] }),
    s('b2', { links: [link('end')] }),
    s('end'),
    s('lose'),
  ];
  const g = plotGraph(scenes);
  const at = id => g.nodes.find(n => n.id === id);
  assert.equal(at('start').layer, 0);
  assert.equal(at('a').layer, 1); assert.equal(at('b').layer, 1);
  assert.equal(at('b2').layer, 2);
  assert.equal(at('end').layer, 3, 'merge sits after the longest path');
  assert.equal(at('lose').layer, 0, 'unconnected scenes stay in the first column');
  assert.deepEqual([at('a').row, at('b').row], [0, 1]);
  assert.equal(g.layers, 4);
  assert.equal(g.edges.filter(e => e.back).length, 0);
});

test('Plot network: cycles and returns never loop; missing targets are reported, not dropped', () => {
  const g = plotGraph([
    s('x', { links: [link('y')] }),
    s('y', { links: [link('x'), link('elsewhere')] }),
    s('z', { links: [link('x', 'return')] }),
  ]);
  assert.equal(g.nodes.find(n => n.id === 'y').layer, 1);
  assert.deepEqual(g.edges.filter(e => e.back).map(e => e.from + '>' + e.to).sort(), ['y>x', 'z>x']);
  assert.deepEqual(g.outside, [{ from: 'y', to: 'elsewhere' }]);
  assert.deepEqual(plotGraph([]), { nodes: [], edges: [], outside: [], layers: 0, rows: 0 });
});

test('Timeline: lanes per group, shared lane first, equal time order means parallel', () => {
  const t = plotTimeline([
    s('a', { timeOrder: 2, lane: 'Gruppe A', timeLabel: 'Mitternacht' }),
    s('b', { timeOrder: 2, lane: 'Gruppe B' }),
    s('c', { timeOrder: 1, timeLabel: 'Abend' }),
    s('d'),
  ]);
  assert.deepEqual(t.lanes, [sharedLane, 'Gruppe A', 'Gruppe B']);
  assert.deepEqual(t.columns.map(c => c.label), ['Abend', 'Mitternacht', 'Ohne Zeitangabe']);
  const at = id => t.cells.find(c => c.id === id);
  assert.equal(at('a').column, at('b').column, 'parallel');
  assert.notEqual(at('a').lane, at('b').lane);
  assert.equal(at('c').column, 0);
  assert.equal(at('d').column, 2);
  assert.equal(at('d').lane, 0);
});

test('Evening order fills gaps faintly; real connections always win', () => {
  const plain = plotGraph([s('a'), s('b'), s('c')], { sequence: ['a', 'b', 'c'] });
  assert.deepEqual(plain.nodes.map(n => n.layer), [0, 1, 2], 'unlinked evening reads left to right');
  assert.ok(plain.edges.every(e => e.implicit));
  const mixed = plotGraph([s('a', { links: [link('c')] }), s('b'), s('c'), s('d')], { sequence: ['a', 'b', 'c', 'd'] });
  const implicit = mixed.edges.filter(e => e.implicit).map(e => e.from + '>' + e.to);
  assert.deepEqual(implicit, ['c>d'], 'a has its own link, c is already reached; b is a loose idea');
  assert.equal(mixed.nodes.find(n => n.id === 'd').layer, 2);
  assert.deepEqual(plotGraph([s('a'), s('b')]).edges, [], 'no sequence, no implicit edges (book view)');
});

test('Branches leaving the view become ghost nodes without links; archived targets are left out', async () => {
  const { linkedOutside, nextScenes } = await import('../domain/storyboard-views.ts');
  const list = [s('a', { links: [link('b'), link('x'), link('gone'), link('old')] }), s('b')];
  const all = [...list, s('x', { links: [link('a')] }), { ...s('old'), archived: true }, s('y')];
  const ghosts = linkedOutside(list, all);
  assert.deepEqual(ghosts.map(g => g.id), ['x']);
  assert.equal(ghosts[0].board.links, undefined, 'ghosts do not pull further scenes in');
  const next = nextScenes(list[0], all);
  assert.deepEqual(next.map(n => [n.link.to, n.scene?.id ?? null]), [['b', 'b'], ['x', 'x'], ['gone', null], ['old', 'old']]);
  assert.deepEqual(nextScenes(undefined, all), []);
});

test('An old free-text branch becomes a scene idea plus connection, losslessly', async () => {
  const { possibilityAsScene } = await import('../domain/storyboard-blocks.ts');
  assert.deepEqual(possibilityAsScene({ title: ' Flucht über die Dächer ', text: 'Sie entkommen <knapp>.' }, 'buch-1'),
    { title: 'Flucht über die Dächer', storyId: 'buch-1', board: { status: 'idea', premise: 'Sie entkommen <knapp>.' }, gmNotes: '' });
  const long = possibilityAsScene({ title: '', text: 'x'.repeat(2500) }, '');
  assert.equal(long.title, 'Abzweigung');
  assert.equal(long.board.premise.length, 2000);
  assert.match(long.gmNotes, /^<p>x{2500}<\/p>$/, 'full text kept in the SL notes');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), title: long.title, gmNotes: long.gmNotes, board: long.board }).success, true);
});
