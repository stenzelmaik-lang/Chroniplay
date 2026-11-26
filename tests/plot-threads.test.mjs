import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPossibilityAsScene, effectiveClueFound, emptyThread, isStrandOpen, newStrand, openStrands, stateName, strandKindList, strandKinds, strandsForScene, threadCommandSchema, threadCounts, threadDocumentSchema } from '../domain/plot-threads.ts';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { sceneWithoutBoard } from '../domain/storyboard-blocks.ts';

const thread = (id, over = {}, strands = []) => ({ id, version: 1, updatedAt: '', document: { ...emptyThread(), title: id, ...over, strands } });

test('Threads validate kinds, states and limits; a strand state must fit its kind', () => {
  const doc = { ...emptyThread('plot-1'), strands: [newStrand('clue', 'Blutspur', 'scene-1'), newStrand('event', 'Frist läuft ab')] };
  assert.equal(threadDocumentSchema.safeParse(doc).success, true);
  assert.equal(doc.strands[0].state, 'hidden', 'strands start in the first state');
  assert.equal(threadDocumentSchema.safeParse({ ...doc, strands: [{ ...doc.strands[0], state: 'revealed' }] }).success, false, 'revealed belongs to secrets');
  assert.equal(threadDocumentSchema.safeParse({ ...doc, kind: 'vampir' }).success, false);
  assert.equal(threadDocumentSchema.safeParse({ ...doc, strands: [doc.strands[0], doc.strands[0]] }).success, false, 'unique strand ids');
  assert.equal(threadDocumentSchema.safeParse({ ...doc, bookIds: ['a', 'a'] }).success, false);
  assert.equal(threadDocumentSchema.safeParse({ ...doc, revealToPlayers: true }).success, false, 'no unknown keys, no publication flags');
  assert.equal(threadCommandSchema.safeParse({ action: 'save', id: 'thread-x', version: 1, document: doc }).success, true);
  for (const kind of strandKindList) {
    const states = Object.keys(strandKinds[kind].states);
    assert.ok(strandKinds[kind].done.every(s => states.includes(s)), kind + ' done states exist');
  }
});

test('Open and closed strands; decisions are records, never open', () => {
  assert.equal(isStrandOpen({ kind: 'clue', state: 'planted' }), true);
  assert.equal(isStrandOpen({ kind: 'clue', state: 'found' }), false);
  assert.equal(isStrandOpen({ kind: 'decision', state: 'made' }), false);
  assert.equal(isStrandOpen({ kind: 'promise', state: 'broken' }), false);
  assert.equal(stateName({ kind: 'consequence', state: 'open' }), 'Vorgemerkt');
  const counts = threadCounts({ ...emptyThread(), strands: [newStrand('clue', 'a'), { ...newStrand('secret', 'b'), state: 'revealed' }, newStrand('event', 'c')] });
  assert.deepEqual(counts, { open: 2, total: 3, byKind: { clue: 1, event: 1 } });
});

test('Open strands: deadlines first, then upcoming scenes, then the rest; closed threads left out', () => {
  const deadline = { ...newStrand('event', 'Der Prinz verliert die Geduld'), deadline: 'Nacht 3' };
  const soon = newStrand('consequence', 'Die Wache erinnert sich', 's2');
  const later = newStrand('consequence', 'Der Brief taucht auf', 's9');
  const loose = newStrand('secret', 'Wer zahlte?');
  const threads = [thread('A', {}, [loose, later]), thread('B', {}, [soon, deadline]), thread('C', { status: 'resolved' }, [newStrand('clue', 'alt')])];
  const order = new Map([['s2', 1], ['s9', 7]]);
  assert.deepEqual(openStrands(threads, order).map(o => o.strand.title), ['Der Prinz verliert die Geduld', 'Die Wache erinnert sich', 'Der Brief taucht auf', 'Wer zahlte?']);
  assert.deepEqual(strandsForScene(threads, 's2').map(o => o.threadTitle + ':' + o.strand.title), ['B:Die Wache erinnert sich']);
  assert.deepEqual(strandsForScene([thread('D', {}, [{ ...soon, state: 'applied' }])], 's2'), [], 'applied consequences are no longer pending');
});

test('Linked clue dossiers report their real discovery; unlinked clues stay manual', () => {
  const linked = { ...newStrand('clue', 'Pager'), refIds: ['clue-1', 'npc-1'] };
  assert.equal(effectiveClueFound(linked, { 'clue-1': 'known' }), true);
  assert.equal(effectiveClueFound(linked, { 'clue-1': 'unknown' }), false);
  assert.equal(effectiveClueFound({ ...newStrand('clue', 'frei') }, { 'clue-1': 'known' }), null);
  assert.equal(effectiveClueFound(newStrand('secret', 'x'), {}), null);
});

test('Scenes join threads through the board; rollback keeps the thread ids as text', () => {
  const doc = sceneDocumentSchema.parse({ ...emptyScene(), board: { threads: ['thread-a', 'thread-b'], lane: 'Gruppe A' } });
  assert.deepEqual(doc.board.threads, ['thread-a', 'thread-b']);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { threads: ['x', 'x'] } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { threads: Array.from({ length: 11 }, (_, i) => 't' + i) } }).success, false);
  assert.match(sceneWithoutBoard(doc).document.gmNotes, /Handlungsstränge: thread-a, thread-b/);
});

test('Old book possibilities become scene ideas with a matching status, losslessly', () => {
  assert.deepEqual(bookPossibilityAsScene({ title: ' Bündnis ', text: 'Sie verbünden sich.', status: 'open' }), { title: 'Bündnis', board: { status: 'idea', premise: 'Sie verbünden sich.' }, gmNotes: '' });
  assert.equal(bookPossibilityAsScene({ title: 'x', text: '', status: 'used' }).board.status, 'ready');
  assert.deepEqual(bookPossibilityAsScene({ title: '', text: '', status: 'discarded' }), { title: 'Möglichkeit', board: { status: 'deferred' }, gmNotes: '' });
  const long = bookPossibilityAsScene({ title: 'L', text: '<' + 'y'.repeat(2500), status: 'open' });
  assert.equal(long.board.premise.length, 2000);
  assert.match(long.gmNotes, /^<p>&lt;y+<\/p>$/);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), title: long.title, gmNotes: long.gmNotes, board: long.board }).success, true);
});
