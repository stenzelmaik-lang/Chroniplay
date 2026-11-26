import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityGroups, attributeGroups } from '../domain/character-engine.ts';
import { W10_ABILITY_KEYS, W10_ATTRIBUTE_KEYS } from '../domain/trait-ids.ts';
import { evaluateNormalV20 } from '../domain/w10.ts';
import { narrativeProfile, ruleProfile, ruleProfiles, ruleSheetSchema, v20Profile } from '../domain/rule-profiles.ts';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { checkToElement, checksFromElements, elementToCheck, freeTextChecks, newCheck, sceneWithoutChecks, withCheckMirrors } from '../domain/scene-checks.ts';
import { withWorkshopMirrors, toWorkshop } from '../domain/scene-workshop.ts';
import { regieTexts } from '../domain/scene-possibilities.ts';
import { encodeRichText, richTextToPlainText } from '../domain/location-rich-text.ts';

let n = 0;
const id = () => '00000000-0000-4000-b000-' + String(++n).padStart(12, '0');
const rich = text => encodeRichText({ version: 1, blocks: [{ type: 'paragraph', children: [{ text }] }] });
const scene = over => sceneDocumentSchema.parse({ ...emptyScene(), ...over });
const v20 = (over = {}) => ({ ...newCheck('v20-kleve', id()), title: 'Zustand untersuchen', spec: { attributeId: 'perception', abilityId: 'medicine' }, difficulty: 7, outcomes: { success: 'Er hat Fieber', botch: 'Er schreckt hoch' }, note: rich('Ruhig fragen'), ...over });

test('Register: V20 and a dice-free profile; the V20 traits match the character sheet exactly', () => {
  assert.deepEqual(ruleProfiles.map(p => p.id), ['v20-kleve', 'narrative']);
  assert.equal(ruleProfile('dnd'), undefined);
  const attributes = v20Profile.traitGroups.filter(g => g.role === 'attribute').flatMap(g => g.traits.map(t => t.label));
  const abilities = v20Profile.traitGroups.filter(g => g.role === 'ability').flatMap(g => g.traits.map(t => t.label));
  assert.deepEqual(attributes, Object.values(attributeGroups).flat());
  assert.deepEqual([...abilities].sort(), [...Object.values(abilityGroups).flat()].sort());
  assert.equal(new Set(v20Profile.traitGroups.flatMap(g => g.traits.map(t => t.id))).size, Object.keys(W10_ATTRIBUTE_KEYS).length + Object.keys(W10_ABILITY_KEYS).length, 'every trait id exactly once');
  assert.equal(narrativeProfile.dice, false);
  assert.equal(narrativeProfile.evaluate, undefined, 'no dice adapter without dice');
});

test('V20 adapter gives exactly the results of the existing engine (no change to any roll)', () => {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 10 + 1;
  for (let i = 0; i < 2000; i++) {
    const pool = 1 + (i % 12), difficulty = 2 + (i % 9);
    const faces = Array.from({ length: pool }, next);
    const engine = evaluateNormalV20(faces, difficulty), profile = v20Profile.evaluate(faces, {}, difficulty);
    assert.equal(profile.outcome, engine.outcome, JSON.stringify({ faces, difficulty }));
    assert.equal(profile.successes, engine.netSuccesses);
  }
});

test('V20 pool from a sheet by profile (NPC sheets later)', () => {
  const sheet = ruleSheetSchema.parse({ profileId: 'v20-kleve', values: { perception: 3, medicine: 2 } });
  assert.equal(v20Profile.pool(sheet, { attributeId: 'perception', abilityId: 'medicine' }), 5);
  assert.equal(v20Profile.pool(sheet, { attributeId: 'perception', abilityId: '' }), 3);
  assert.equal(v20Profile.pool(sheet, { attributeId: '', abilityId: 'medicine' }), null, 'without attribute the player decides');
  assert.equal(v20Profile.pool(ruleSheetSchema.parse({ profileId: 'v20-kleve', values: { Wahrnehmung: 4 } }), { attributeId: 'perception', abilityId: '' }), 4, 'German sheet keys work too');
});

test('Checks are validated by their profile', () => {
  assert.equal(scene({ checks: [v20()] }).checks.length, 1);
  const bad = over => sceneDocumentSchema.safeParse({ ...emptyScene(), checks: [v20(over)] }).success;
  assert.equal(bad({ profileId: 'dnd' }), false);
  assert.equal(bad({ spec: { attributeId: 'luck', abilityId: '' } }), false);
  assert.equal(bad({ difficulty: 11 }), false);
  assert.equal(bad({ outcomes: { partial: 'x' } }), false, 'V20 has no partial success');
  const story = { ...newCheck('narrative', id()), title: 'Avi überzeugen', spec: { approach: 'mit Respekt' }, difficulty: 3, outcomes: { partial: 'er hilft, will aber etwas' } };
  assert.equal(scene({ checks: [story] }).checks[0].profileId, 'narrative');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), checks: [{ ...story, difficulty: 6 }] }).success, false, 'narrative difficulty 1–4');
});

test('V20 check ⇄ classic element: same id, every field 1:1', () => {
  const c = v20();
  const element = checkToElement(c);
  assert.equal(element.id, c.id);
  assert.deepEqual(element.check, { attributeId: 'perception', abilityId: 'medicine', difficulty: 7, targetCharacterIds: [], consequences: { success: 'Er hat Fieber', failure: '', botch: 'Er schreckt hoch' } });
  assert.deepEqual(elementToCheck(element), c, 'round trip is lossless');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), elements: [element] }).success, true);
  assert.equal(checkToElement({ ...newCheck('narrative', id()), title: 'x' }), null, 'other profiles have no classic element');
});

test('Mirror: elements follow the checks; a classic edit wins; deletion; adoption; free-text checks stay classic', () => {
  const c = v20(), freeText = { id: id(), kind: 'check', title: 'Wahrnehmung + Aufmerksamkeit SG 6', text: '', referenceId: '', fileId: '' };
  const first = withCheckMirrors(scene({ checks: [c], elements: [freeText] }));
  assert.deepEqual(first.elements.map(e => e.id), [freeText.id, c.id]);
  assert.deepEqual(freeTextChecks(first).map(e => e.id), [freeText.id], 'blockless checks are not converted (the Regie reads their text)');
  const edited = { ...first, elements: first.elements.map(e => e.id === c.id ? { ...e, check: { ...e.check, difficulty: 9 } } : e) };
  assert.equal(withCheckMirrors(edited, first).checks[0].difficulty, 9, 'a classic edit wins');
  assert.equal(withCheckMirrors({ ...first, elements: [freeText] }, first).checks.length, 0, 'a classic deletion removes the check');
  const classicNew = checkToElement(v20({ title: 'Neu im Material-Fenster' }));
  assert.equal(withCheckMirrors({ ...first, elements: [...first.elements, classicNew] }, first).checks.length, 2, 'a structured check from the classic window is adopted');
  const story = withCheckMirrors({ ...first, checks: [{ ...c, profileId: 'narrative', spec: { approach: '' }, difficulty: 2, outcomes: {} }] }, first);
  assert.equal(story.elements.some(e => e.id === c.id), false, 'switching to a dice-free profile removes the classic element');
});

test('Opening an older scene converts structured checks losslessly; the current Regie stays unchanged', () => {
  const element = checkToElement(v20());
  const old = scene({ elements: [element] });
  const ws = toWorkshop(old, id);
  assert.equal(ws.checks.length, 1);
  assert.deepEqual(withWorkshopMirrors(ws).elements, old.elements, 'the Regie sees exactly the same element');
  assert.equal(checksFromElements(scene({})).checks, undefined);
});

test('Dice-free checks appear as text in the current Regie; rollback keeps them in the notes', () => {
  const story = { ...newCheck('narrative', id()), title: 'Avi überzeugen', spec: { approach: 'mit Respekt' }, difficulty: 3, outcomes: { partial: 'er will etwas dafür' } };
  const doc = withWorkshopMirrors(scene({ checks: [v20(), story] }));
  const text = richTextToPlainText(regieTexts(doc).possibleConsequences);
  assert.match(text, /Probe: Avi überzeugen · Erzählerisch \(ohne Würfel\)\nmit Respekt · Schwer\nGelingt mit Preis: er will etwas dafür/);
  assert.equal(text.includes('Zustand untersuchen'), false, 'V20 checks are issued from the check desk, not repeated as text');
  const { document, changed } = sceneWithoutChecks(doc);
  assert.equal(changed, true);
  assert.equal('checks' in document, false);
  assert.equal(document.elements.length, 1, 'the V20 check stays as classic element');
  assert.match(document.gmNotes, /Probe „Avi überzeugen“ \(Erzählerisch \(ohne Würfel\)\): mit Respekt · Schwer · Gelingt mit Preis: er will etwas dafür/);
  assert.equal(sceneDocumentSchema.safeParse(document).success, true);
});
