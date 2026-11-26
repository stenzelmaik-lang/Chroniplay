import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { summarizeSceneRow } from '../domain/scene-list.ts';
import { boardAreas, boardBlockKinds, boardBlockTypes, boardDuration, boardStatus, compactBoard, formatMinutes, isOptionalBlock, sceneWithoutBoard, visibleBoardAreas } from '../domain/storyboard-blocks.ts';
import { eveningStatusProgress, guideState, sceneStatus } from '../domain/storyboard.ts';

const board = { kind: 'decision', status: 'review', premise: 'Wem vertraut die Runde?', plot: 'side', optional: true, triggers: 'Nach dem Treffen <am Hafen>', minutes: 45, priority: 'high' };

test('Older scenes stay valid without board; a full board is accepted, unknown keys are not', () => {
  const plain = sceneDocumentSchema.parse(emptyScene());
  assert.equal('board' in plain, false, 'untouched scenes do not gain a board');
  assert.deepEqual(sceneDocumentSchema.parse({ ...emptyScene(), board }).board, board);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { kind: 'unbekannt' } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { colour: 'rot' } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { minutes: 0 } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { minutes: 601 } }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), board: { premise: 'x'.repeat(2001) } }).success, false);
});

test('Every block type offers a known subset of areas; the regular scene offers all eight', () => {
  assert.equal(boardBlockKinds.length, 10);
  for (const kind of boardBlockKinds) {
    assert.ok(boardBlockTypes[kind].label && boardBlockTypes[kind].areas.length > 0, kind);
    assert.ok(boardBlockTypes[kind].areas.every(area => boardAreas.includes(area)), kind);
  }
  assert.deepEqual([...boardBlockTypes.scene.areas], [...boardAreas]);
  assert.deepEqual([...boardBlockTypes.note.areas], ['gmNotes']);
});

test('Areas follow the type, but filled areas are never hidden and "all" shows everything', () => {
  const none = () => false;
  assert.deepEqual(visibleBoardAreas(undefined, none), [...boardAreas], 'no board = regular scene');
  assert.deepEqual(visibleBoardAreas({ kind: 'transition' }, none), ['narration', 'atmosphere', 'gmNotes']);
  assert.deepEqual(visibleBoardAreas({ kind: 'transition' }, area => area === 'secrets'), ['narration', 'atmosphere', 'secrets', 'gmNotes'], 'content stays reachable, in guide order');
  assert.deepEqual(visibleBoardAreas({ kind: 'note' }, none, true), [...boardAreas]);
});

test('Status: the SL decides; without a choice the derived readiness stands in', () => {
  assert.equal(boardStatus(undefined, 'idea'), 'idea');
  assert.equal(boardStatus(undefined, 'draft'), 'working');
  assert.equal(boardStatus(undefined, 'ready'), 'ready');
  assert.equal(boardStatus({ status: 'ready' }, 'idea'), 'ready', 'an empty conversation scene may be ready');
  assert.equal(boardStatus({ status: 'deferred' }, 'ready'), 'deferred');
});

test('Optional, duration and compact storage', () => {
  assert.equal(isOptionalBlock(undefined), false);
  assert.equal(isOptionalBlock({ optional: true }), true);
  assert.equal(isOptionalBlock({ kind: 'optional' }), true);
  assert.deepEqual(boardDuration([{ minutes: 30 }, undefined, { minutes: 45 }, { minutes: 90, status: 'deferred' }]), { minutes: 75, estimated: 2 });
  assert.equal(formatMinutes(45), '45 Min.');
  assert.equal(formatMinutes(120), '2 Std.');
  assert.equal(formatMinutes(135), '2 Std. 15 Min.');
  assert.equal(compactBoard({ kind: 'scene', premise: '', optional: false, minutes: undefined }), undefined, 'an untouched board is not stored');
  assert.deepEqual(compactBoard({ kind: 'event', premise: 'Frist läuft ab', optional: false }), { kind: 'event', premise: 'Frist läuft ab' });
});

test('Rollback aid moves every board value into the SL notes, losslessly and idempotently', () => {
  const doc = sceneDocumentSchema.parse({ ...emptyScene(), gmNotes: '<p>Alt.</p>', board });
  const { document, changed } = sceneWithoutBoard(doc);
  assert.equal(changed, true);
  assert.equal('board' in document, false, 'older builds reject unknown keys');
  assert.match(document.gmNotes, /^<p>Alt\.<\/p>/);
  assert.match(document.gmNotes, /Typ: Entscheidungspunkt · Status: Prüfung erforderlich · Nebenhandlung · optional · Dauer: 45 Min\. · Priorität: Hoch/);
  assert.match(document.gmNotes, /Grobe Idee: Wem vertraut die Runde\?/);
  assert.match(document.gmNotes, /Voraussetzungen und Auslöser: Nach dem Treffen &lt;am Hafen&gt;/, 'escaped');
  assert.equal(sceneDocumentSchema.safeParse(document).success, true, 'still a valid scene');
  assert.equal(sceneWithoutBoard(document).changed, false, 'idempotent');
  const plain = sceneDocumentSchema.parse(emptyScene());
  assert.equal(sceneWithoutBoard(plain).document, plain, 'scenes without board stay untouched');
});

test('Scene list carries the board and searches the rough idea', () => {
  const row = { id: 'scene-1', version: 2, updated_at: '2026-11-25T10:00:00Z', title: 'Hafen', gm_body: JSON.stringify({ ...emptyScene(), title: 'Hafen', board }), content: JSON.stringify({ documentKind: 'story_scene', runs: [], publications: [] }) };
  const summary = summarizeSceneRow(row);
  assert.deepEqual(summary.board, board);
  assert.match(summary.searchText, /Wem vertraut die Runde/);
  const plainRow = { ...row, gm_body: JSON.stringify({ ...emptyScene(), title: 'Hafen' }) };
  assert.equal('board' in summarizeSceneRow(plainRow), false);
});

test('Evening status progress counts the five statuses; deferred scenes do not block "Spielbereit"', () => {
  const prep = (over = {}) => ({ narrationExcerpt: '', sections: [], npcIds: [], clueIds: [], embeddedFileIds: [], materials: [], ...over });
  const scene = (id, over = {}) => ({ id, version: 1, updatedAt: '', title: id, storyId: '', placeId: '', parentId: '', sessionIds: [], favorite: false, pinned: false, searchText: '', elements: [], runs: [], preparation: prep(), ...over });
  const scenes = [
    scene('a', { board: { status: 'ready' } }),
    scene('b', { preparation: prep({ narrationExcerpt: 'x', sections: ['narration'] }) }),
    scene('c', { board: { status: 'deferred' } }),
    scene('d', { board: { status: 'review' } }),
  ];
  assert.equal(sceneStatus(scenes[1]), 'working');
  const session = { title: 'Abend', date: '', summary: '', notes: '', storyIds: [], sceneIds: ['a', 'b', 'c', 'd'], placeIds: [], status: 'draft', favorite: false, pinned: false };
  const progress = eveningStatusProgress('abend', session, scenes);
  assert.deepEqual(progress, { total: 4, idea: 0, working: 1, review: 1, ready: 1, deferred: 1 });
  assert.equal(guideState({ bookId: 'b', eveningId: 'abend', progress }).ready, false);
  assert.equal(guideState({ bookId: 'b', eveningId: 'abend', progress: { total: 2, idea: 0, ready: 1, deferred: 1 } }).ready, true);
  assert.equal(guideState({ bookId: 'b', eveningId: 'abend', progress: { total: 1, idea: 0, ready: 0, deferred: 1 } }).ready, false, 'only deferred is not ready');
});
