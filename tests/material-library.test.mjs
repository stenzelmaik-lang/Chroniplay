import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { defaultMaterial } from '../domain/material-system.ts';
import { elementFromMaterial, entryFromElement, libraryMaterialTypes, materialEntrySchema, sceneWithoutMaterialUses, withMaterialCopies } from '../domain/material-library.ts';

let n = 0;
const id = () => '00000000-0000-4000-9000-' + String(++n).padStart(12, '0');
const file = fileId => ({ id: id(), fileId, title: '' });
const entry = (title, type = 'letter', over = {}) => materialEntrySchema.parse({ title, text: 'Inhalt ' + title, material: { ...defaultMaterial(type), files: [file('datei-' + title)] }, ...over });
const use = (materialId, over = {}) => ({ id: id(), materialId, how: 'open', byNpcId: '', condition: '', audience: '', takeable: true, ...over });
const scene = over => sceneDocumentSchema.parse({ ...emptyScene(), ...over });

test('Library entries: Spielmaterial 3.0 block, no pager or backdrop, tags unique', () => {
  assert.deepEqual(libraryMaterialTypes, ['image', 'letter', 'dossier', 'audio', 'video', 'other']);
  assert.equal(entry('Brief').material.type, 'letter');
  assert.equal(materialEntrySchema.safeParse({ title: 'P', material: defaultMaterial('pager') }).success, false);
  assert.equal(materialEntrySchema.safeParse({ title: 'B', material: defaultMaterial('backdrop') }).success, false);
  assert.equal(materialEntrySchema.safeParse({ title: 'T', material: defaultMaterial('image'), tags: ['Keller', 'keller'] }).success, false);
});

test('Uses are optional and each material appears only once per scene', () => {
  assert.equal('materialUses' in scene({}), false);
  const u = use('material-a');
  assert.equal(scene({ materialUses: [u] }).materialUses[0].takeable, true);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), materialUses: [u, { ...u, id: id() }] }).success, false, 'unique material');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), materialUses: [{ ...u, how: 'thrown' }] }).success, false);
});

test('A use becomes a classic element with the same id; takeable is decided per use', () => {
  const lib = entry('Brief');
  const u = use('material-a', { takeable: false });
  const e = elementFromMaterial(u, lib);
  assert.equal(e.id, u.id);
  assert.equal(e.kind, 'handout');
  assert.equal(e.fileId, 'datei-Brief');
  assert.equal(e.material.takeable, false);
  assert.equal('takeable' in elementFromMaterial({ ...u, takeable: true }, lib).material, false, 'takeable is stored only when off');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), elements: [e] }).success, true, 'the copy is a valid scene element');
});

test('Copies: derived, refreshed from the library, re-created when missing; a classic edit detaches the use', () => {
  const a = entry('Foto', 'image'), b = entry('Akte', 'dossier');
  const ua = use('material-a'), ub = use('material-b');
  const library = new Map([['material-a', a], ['material-b', b]]);
  const first = withMaterialCopies(scene({ materialUses: [ua, ub] }), null, library);
  assert.deepEqual(first.elements.map(e => e.id), [ua.id, ub.id]);
  const changed = new Map([['material-a', { ...a, title: 'Foto neu' }], ['material-b', b]]);
  assert.equal(withMaterialCopies(first, first, changed).elements[0].title, 'Foto neu', 'library changes reach the copy');
  const stale = { ...first, elements: [first.elements[1]] };
  assert.equal(withMaterialCopies(stale, first, library).elements.length, 2, 'a missing copy is re-created, never read as a deletion');
  const classic = { ...first, elements: [{ ...first.elements[0], title: 'Von Hand geändert' }, first.elements[1]] };
  const detached = withMaterialCopies(classic, first, library);
  assert.deepEqual(detached.materialUses.map(u => u.id), [ub.id], 'the edited material leaves the library use');
  assert.equal(detached.elements[0].title, 'Von Hand geändert', 'and stays as a normal scene element');
  const gone = withMaterialCopies(first, first, new Map([['material-b', b]]));
  assert.equal(gone.elements[0].title, 'Foto', 'a removed library entry keeps the stored copy');
  const classicElement = { id: id(), kind: 'text', title: 'Notiz', text: '', referenceId: '', fileId: '' };
  assert.equal(withMaterialCopies({ ...first, elements: [classicElement, ...first.elements] }, first, library).elements[0], classicElement, 'other elements stay in place');
});

test('Adopting a classic element keeps its content; pager and checks stay classic', () => {
  const lib = entry('Brief');
  const element = elementFromMaterial(use('x', { takeable: false }), lib);
  const adopted = entryFromElement(element);
  assert.equal(adopted.title, 'Brief');
  assert.equal(adopted.material.takeable, false);
  assert.equal(materialEntrySchema.safeParse(adopted).success, true);
  assert.equal(entryFromElement({ ...element, material: undefined }), null);
  assert.equal(entryFromElement({ ...element, material: { ...element.material, type: 'pager' } }), null);
});

test('Rollback moves the use details into the SL notes; the copies stay as classic elements', () => {
  const u = use('material-a', { how: 'handover', byNpcId: 'npc-avi', condition: 'nach dem Gespräch', takeable: false });
  const doc = withMaterialCopies(scene({ materialUses: [u] }), null, new Map([['material-a', entry('Brief')]]));
  const { document, changed } = sceneWithoutMaterialUses(doc);
  assert.equal(changed, true);
  assert.equal('materialUses' in document, false);
  assert.equal(document.elements.length, 1);
  assert.match(document.gmNotes, /Material „Brief“: wird übergeben · von npc-avi · Bedingung: nach dem Gespräch · nicht einsteckbar/);
  assert.equal(sceneDocumentSchema.safeParse(document).success, true);
  assert.equal(sceneWithoutMaterialUses(document).changed, false);
});
