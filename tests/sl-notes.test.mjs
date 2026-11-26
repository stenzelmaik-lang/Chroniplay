import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPageEdit, isNotebookRow, pageFromRow } from '../domain/notebook.ts';
import { emptyRefs, noteMatches, readRefs, slNoteCommandSchema, slNoteFromRow, sortSlNotes, withSlFields } from '../domain/sl-notes.ts';

const row = (body, over = {}) => ({ id: 'n1', owner_id: 'gm', title: 'T', visibility: 'private', body: JSON.stringify(body), version: 1, created_at: '2026-11-26T10:00:00.000Z', updated_at: '2026-11-26T10:00:00.000Z', ...over });

test('An SL note is a normal notebook page with kind and references', () => {
  const body = withSlFields(applyPageEdit({}, { title: '', text: 'Zugestellte Tür später aufgreifen', date: '2026-11-26', tags: ['Keller'] }).body, 'question', { ...emptyRefs(), sceneIds: ['scene-05'], npcIds: ['npc-emil'] });
  const r = row(body);
  assert.equal(isNotebookRow(r, 'gm'), true, 'it stays visible in the SL notebook');
  const note = slNoteFromRow(r);
  assert.equal(note.kind, 'question');
  assert.deepEqual(note.refs.sceneIds, ['scene-05']);
  assert.equal(pageFromRow(r).text, 'Zugestellte Tür später aufgreifen', 'the notebook reads it like any page');
  const plain = withSlFields({ text: 'x', other: 1 }, 'note', emptyRefs());
  assert.deepEqual(plain, { text: 'x', other: 1 }, 'plain notes add nothing to the body; other fields are kept');
  assert.deepEqual(readRefs({ slRefs: { sceneIds: 'kaputt' } }), emptyRefs(), 'broken references read as none');
});

test('Filter by scene, NPC, place and evening; questions and promises first', () => {
  const a = { refs: { ...emptyRefs(), sceneIds: ['s1'], npcIds: ['n1'] }, kind: 'note', updatedAt: '2026-11-26T12:00:00Z' };
  const b = { refs: { ...emptyRefs(), sceneIds: ['s1'] }, kind: 'promise', updatedAt: '2026-11-26T08:00:00Z' };
  assert.equal(noteMatches(a, { sceneId: 's1', npcId: 'n1' }), true);
  assert.equal(noteMatches(b, { sceneId: 's1', npcId: 'n1' }), false);
  assert.equal(noteMatches(b, {}), true);
  assert.deepEqual(sortSlNotes([a, b]).map(n => n.kind), ['promise', 'note']);
});

test('Commands are strict: kind, unique references, valid date', () => {
  const base = { action: 'save', text: 'x', date: '2026-11-26' };
  assert.equal(slNoteCommandSchema.safeParse({ ...base, kind: 'idea', refs: { ...emptyRefs(), sceneIds: ['s1'] } }).success, true);
  assert.equal(slNoteCommandSchema.safeParse({ ...base, kind: 'secret' }).success, false);
  assert.equal(slNoteCommandSchema.safeParse({ ...base, refs: { ...emptyRefs(), npcIds: ['a', 'a'] } }).success, false);
  assert.equal(slNoteCommandSchema.safeParse({ ...base, date: '26.11.2026' }).success, false);
  assert.equal(slNoteCommandSchema.safeParse({ ...base, refs: { sceneIds: [], npcIds: [], placeIds: [], sessionIds: [], factionIds: [] } }).success, false);
});
