import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneReadiness, moveId, reorderedSessionSceneIds, bookEvenings, looseEvenings, unplacedBookScenes, eveningProgress, guideState } from '../domain/storyboard.ts';

const prep = (over = {}) => ({ narrationExcerpt: '', sections: [], npcIds: [], clueIds: [], embeddedFileIds: [], materials: [], ...over });
const scene = (id, over = {}) => ({ id, version: 1, updatedAt: '', title: id, storyId: 'buch-3', placeId: '', parentId: '', sessionIds: [], favorite: false, pinned: false, searchText: '', elements: [], runs: [], preparation: prep(), ...over });
const evening = (id, over = {}) => ({ id, version: 1, updatedAt: '', document: { title: id, date: '', summary: '', notes: '', storyIds: [], sceneIds: [], placeIds: [], status: 'draft', favorite: false, pinned: false, ...over } });

test('Readiness is a hint derived from content: idea, draft, ready', () => {
  assert.equal(sceneReadiness(scene('a')), 'idea');
  assert.equal(sceneReadiness({ preparation: undefined }), 'idea');
  assert.equal(sceneReadiness(scene('b', { preparation: prep({ narrationExcerpt: 'Es regnet.', sections: ['narration'] }) })), 'draft');
  assert.equal(sceneReadiness(scene('c', { preparation: prep({ narrationExcerpt: 'Es regnet.', sections: ['narration', 'gmNotes'] }) })), 'ready');
  assert.equal(sceneReadiness(scene('d', { preparation: prep({ narrationExcerpt: 'Es regnet.', sections: ['narration'], npcIds: ['npc'] }) })), 'ready');
  // a rough idea kept only as private note is still an idea
  assert.equal(sceneReadiness(scene('e', { preparation: prep({ sections: ['gmNotes'] }) })), 'idea');
});

test('moveId moves within bounds and never loses or duplicates ids', () => {
  assert.deepEqual(moveId(['a', 'b', 'c', 'd'], 'a', 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveId(['a', 'b', 'c', 'd'], 'd', 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 99), ['a', 'c', 'b']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', -5), ['b', 'a', 'c']);
  assert.deepEqual(moveId(['a', 'b'], 'x', 0), ['a', 'b']);
});

test('Reordering keeps unavailable linked ids and adopts older scene-side links', () => {
  const scenes = [scene('s1'), scene('s2'), scene('s3', { sessionIds: ['abend'] })];
  const doc = evening('abend', { sceneIds: ['s1', 'gone', 's2'] }).document;
  // visible order: s1, s2, s3 (scene-side link appended); "gone" stays linked at the end
  assert.deepEqual(reorderedSessionSceneIds('abend', doc, scenes, 's3', 0), ['s3', 's1', 's2', 'gone']);
});

test('Books group evenings by ids, not by title; loose evenings and idea tray', () => {
  const scenes = [scene('s1'), scene('s2'), scene('s9', { storyId: 'anderes' }), scene('frei', { storyId: 'buch-3' })];
  const viaStory = evening('Der Hunger bleibt', { storyIds: ['buch-3'] });
  const viaScene = evening('Abend B', { sceneIds: ['s2'] });
  const sameTitleOther = evening('Der Hunger bleibt (anderer)', { sceneIds: ['s9'] });
  const archived = evening('Alt', { storyIds: ['buch-3'], status: 'archived' });
  const all = [viaStory, viaScene, sameTitleOther, archived];
  assert.deepEqual(bookEvenings('buch-3', all, scenes).map(e => e.id), ['Der Hunger bleibt', 'Abend B']);
  assert.deepEqual(looseEvenings(['buch-3'], all, scenes).map(e => e.id), ['Der Hunger bleibt (anderer)']);
  assert.deepEqual(unplacedBookScenes('buch-3', all, scenes).map(s => s.id), ['frei', 's1']);
});

test('Evening progress and guide state support an unfinished story', () => {
  const scenes = [scene('s1', { preparation: prep({ narrationExcerpt: 'x', sections: ['narration', 'gmNotes'] }) }), scene('s2', { preparation: prep({ narrationExcerpt: 'y', sections: ['narration'] }) }), scene('s3')];
  const doc = evening('abend', { sceneIds: ['s1', 's2', 's3'] }).document;
  const progress = eveningProgress('abend', doc, scenes);
  assert.deepEqual(progress, { total: 3, idea: 1, draft: 1, ready: 1 });
  assert.deepEqual(guideState({ bookId: 'buch-3', eveningId: 'abend', progress }), { book: true, evening: true, sketch: true, elaborate: false, ready: false });
  assert.deepEqual(guideState({ bookId: '', eveningId: '', progress: null }), { book: false, evening: false, sketch: false, elaborate: false, ready: false });
});

test('Scene resources list people and material like the evening overview', async () => {
  const { sceneResources } = await import('../domain/storyboard.ts');
  const names = new Map([['npc-1', 'Konrad'], ['npc-2', 'Ilya'], ['clue-1', 'Pager']]);
  const files = new Map([['f-1', 'kaserne.png'], ['f-2', 'karte.png']]);
  const s = scene('x', { preparation: prep({ npcIds: ['npc-1'], clueIds: ['clue-1'], embeddedFileIds: ['f-1', 'f-2'], materials: [
    { id: 'm1', title: 'Kaserne', kind: 'image', referenceId: '', fileId: 'f-1' },
    { id: 'm2', title: '', kind: 'person', referenceId: 'npc-2', fileId: '' },
    { id: 'm3', title: 'Ort', kind: 'place', referenceId: 'p', fileId: '' },
    { id: 'm4', title: 'Brief', kind: 'handout', referenceId: '', fileId: '' },
  ] }) });
  assert.deepEqual(sceneResources(s, names, files), { people: ['Konrad', 'Ilya'], materials: ['Bild: Kaserne', 'Handout: Brief', 'Bild: karte.png', 'Hinweis: Pager'] });
  assert.deepEqual(sceneResources({ preparation: undefined }, names, files), { people: [], materials: [] });
});

test('Evenings run in play order: dated first, then natural title order', async () => {
  const { sortEvenings } = await import('../domain/storyboard.ts');
  const list = [evening('Spielabend 10'), evening('Spielabend 2'), evening('Spielabend 1'), evening('Auftakt', { date: '2026-12-05T19:00' }), evening('Vorspiel', { date: '2026-11-28T19:00' })];
  assert.deepEqual(sortEvenings(list).map(e => e.id), ['Vorspiel', 'Auftakt', 'Spielabend 1', 'Spielabend 2', 'Spielabend 10']);
});
