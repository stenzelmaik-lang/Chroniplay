import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { encodeRichText, richTextToPlainText } from '../domain/location-rich-text.ts';
import { castHasContent, newCast, newPlace, passagesToNarration, primaryWorkshopAreas, sceneWithoutWorkshop, takeOverDialogue, takeOverPerson, takeOverPlace, takeoverElements, toWorkshop, withWorkshopMirrors, workshopAreas, workshopFill } from '../domain/scene-workshop.ts';

let n = 0;
const id = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0');
const rich = text => encodeRichText({ version: 1, blocks: [{ type: 'paragraph', children: [{ text }] }] });
const passage = (title, text, over = {}) => ({ id: id(), title, text: rich(text), direction: '', moodId: '', ...over });
const mood = (name, over = {}) => ({ id: id(), name, backdropFileId: '', youtube: [], effects: [], isDefault: false, ...over });
const scene = over => sceneDocumentSchema.parse({ ...emptyScene(), ...over });

test('Older scenes stay valid; context, passages and moods are optional and validated', () => {
  const plain = scene({});
  assert.equal('passages' in plain || 'moods' in plain || 'context' in plain, false);
  const full = scene({ context: { situation: 'Keller', entries: ['Avi führt hinunter'] }, passages: [passage('01', 'Text')], moods: [mood('Kellergang', { effects: ['fog'], isDefault: true })] });
  assert.equal(full.context.ending, 'open');
  assert.equal(full.passages[0].direction, '');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), moods: [mood('a', { isDefault: true }), mood('b', { isDefault: true })] }).success, false, 'one default mood');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), moods: [mood('a', { effects: ['laser'] })] }).success, false, 'only known table effects');
  const p = passage('x', 'y');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), passages: [p, p] }).success, false, 'unique passage ids');
});

test('Narration mirror: one untitled passage unchanged, several with headings, directions never included', () => {
  const single = passage('', 'Nur ein Text', { direction: 'GEHEIM: langsam lesen' });
  assert.equal(passagesToNarration([single]), single.text);
  const mirror = passagesToNarration([passage('01 · Treppe', 'Ihr steigt hinab.', { direction: 'Pause lassen' }), passage('02 · Gang', 'Ein Sarg lehnt an der Wand.')]);
  const text = richTextToPlainText(mirror);
  assert.match(text, /01 · Treppe\nIhr steigt hinab\.\n02 · Gang\nEin Sarg lehnt an der Wand\./);
  assert.equal(text.includes('Pause lassen'), false, 'SL directions never reach the narration a player could see');
  assert.equal(passagesToNarration([]), '');
  const huge = Array.from({ length: 6 }, (_, i) => passage('A' + i, 'x'.repeat(6000)));
  assert.match(richTextToPlainText(passagesToNarration(huge)), /weitere Abschnitte stehen nur im Storyboard/, 'stays within the narration limit');
});

test('Mirrors follow the workshop; the default mood feeds picture and music for the current Regie', () => {
  const track = { id: id(), title: 'Lüftung', videoId: 'abcdefghijk' };
  const doc = scene({ narration: 'alt', backdropFileId: 'alt-bild', passages: [passage('', 'neu')], moods: [mood('A', { backdropFileId: 'bild-a' }), mood('B', { backdropFileId: 'bild-b', youtube: [track], isDefault: true })] });
  const out = withWorkshopMirrors(doc);
  assert.equal(richTextToPlainText(out.narration), 'neu');
  assert.equal(out.backdropFileId, 'bild-b');
  assert.deepEqual(out.youtube, [track]);
  assert.equal(withWorkshopMirrors(scene({ narration: 'bleibt' })).narration, 'bleibt', 'scenes without passages keep their narration');
  const emptied = withWorkshopMirrors(scene({ narration: 'alt', backdropFileId: 'alt-bild', youtube: [track], passages: [], moods: [] }));
  assert.equal(emptied.narration, '', 'removing every passage empties the mirror');
  assert.equal(emptied.backdropFileId, '');
  assert.deepEqual(emptied.youtube, []);
});

test('A legacy edit of a mirror wins and the workshop follows, without losing directions', () => {
  const p1 = passage('01', 'eins', { direction: 'Regie eins' }), p2 = passage('02', 'zwei', { direction: 'Regie zwei' });
  const m = mood('Standard', { backdropFileId: 'alt', isDefault: true });
  const before = withWorkshopMirrors(scene({ passages: [p1, p2], moods: [m] }));
  const classic = { ...before, narration: rich('In der klassischen Ansicht geändert'), backdropFileId: 'neu' };
  const out = withWorkshopMirrors(classic, before);
  assert.equal(out.passages.length, 1);
  assert.equal(richTextToPlainText(out.passages[0].text), 'In der klassischen Ansicht geändert');
  assert.equal(out.passages[0].direction, 'Regie eins\n\nRegie zwei');
  assert.equal(out.moods[0].backdropFileId, 'neu');
  assert.equal(out.backdropFileId, 'neu');
  const normal = withWorkshopMirrors({ ...before, passages: [{ ...p1, text: rich('neu eins') }, p2] }, before);
  assert.match(richTextToPlainText(normal.narration), /neu eins/, 'a workshop edit rebuilds the mirror');
});

test('Opening an older scene in the workshop is lossless', () => {
  const track = { id: id(), title: 'Bass', videoId: 'abcdefghijk' };
  const old = scene({ narration: rich('Vorlesetext'), backdropFileId: 'bild', youtube: [track] });
  const ws = toWorkshop(old, id);
  assert.equal(ws.passages.length, 1);
  assert.equal(ws.passages[0].text, old.narration);
  assert.deepEqual(ws.moods, [{ id: ws.moods[0].id, name: 'Szenenstimmung', backdropFileId: 'bild', youtube: [track], effects: [], isDefault: true }]);
  assert.equal(withWorkshopMirrors(ws).narration, old.narration, 'the mirror reproduces the old narration exactly');
  assert.equal(withWorkshopMirrors(ws).backdropFileId, 'bild');
  assert.equal(sceneDocumentSchema.safeParse(ws).success, true);
  assert.equal(toWorkshop(scene({}), id).passages, undefined, 'empty scenes get nothing invented');
  assert.equal(toWorkshop(ws, id), ws, 'idempotent');
});

test('Rollback moves context, directions and moods into the SL notes and keeps a valid old scene', () => {
  const doc = withWorkshopMirrors(scene({ gmNotes: rich('Alt.'), context: { situation: 'Keller <unten>', tone: 'beklemmend', entries: ['Treppe'], ending: 'fixed' },
    passages: [passage('01 · Treppe', 'Text', { direction: 'Langsam lesen' })], moods: [mood('Kellergang', { effects: ['fog'], isDefault: true })] }));
  const { document, changed } = sceneWithoutWorkshop(doc);
  assert.equal(changed, true);
  for (const key of ['context', 'passages', 'moods']) assert.equal(key in document, false);
  assert.match(document.gmNotes, /Ausgangssituation: Keller &lt;unten&gt;/);
  assert.match(document.gmNotes, /Einstiege: Treppe/);
  assert.match(document.gmNotes, /Ende: fester Ausgang/);
  assert.match(document.gmNotes, /Regie zu „01 · Treppe“: Langsam lesen/);
  assert.match(document.gmNotes, /Stimmungen: Kellergang \(Standard\) – Effekte: fog/);
  assert.match(richTextToPlainText(document.narration), /Text/, 'the narration mirror stays');
  assert.equal(sceneWithoutWorkshop(document).changed, false, 'idempotent');
});

test('Area list: 13 areas with a table line each; fill counts; block types put their areas first', () => {
  assert.equal(workshopAreas.length, 13);
  assert.ok(workshopAreas.every(a => a.table.length > 10));
  const fill = workshopFill(scene({ narration: rich('x'), npcIds: [], gmNotes: rich('Notiz'), passages: [passage('a', 'b'), passage('c', 'd')] }));
  assert.equal(fill.passages, 2);
  assert.equal(fill.notes, 1);
  assert.equal(fill.events, 0);
  const primary = primaryWorkshopAreas(['narration', 'atmosphere', 'gmNotes']);
  assert.ok(primary.has('passages') && primary.has('moods') && primary.has('notes') && primary.has('overview'));
  assert.equal(primary.has('checks'), false);
});

test('Every area says whether it reaches the table (gold) or stays with the SL (silver)', () => {
  const reach = Object.fromEntries(workshopAreas.map(a => [a.id, a.reach]));
  assert.deepEqual(Object.entries(reach).filter(([, r]) => r === 'table').map(([id]) => id), ['places', 'cast', 'moods', 'material', 'checks', 'insights', 'visions', 'events']);
  assert.equal(reach.passages, 'sl', 'narration is read aloud, never played out');
  assert.equal(workshopAreas.every(a => a.reach === 'table' || a.reach === 'sl'), true);
});

// Szene 2.0, Etappe 2: cast and places
const element = (kind, over = {}) => ({ id: id(), kind, title: kind, text: '', referenceId: '', fileId: '', ...over });

test('Cast and places are optional and validated: one entry per NPC and place, one main place', () => {
  const plain = scene({});
  assert.equal('cast' in plain || 'places' in plain, false);
  const c = newCast('npc-emil', id());
  assert.equal(scene({ cast: [c] }).cast[0].presence, 'start');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), cast: [c, { ...c, id: id() }] }).success, false, 'an NPC only once');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), places: [{ ...newPlace('a', id()), main: true }, { ...newPlace('b', id()), main: true }] }).success, false, 'one main place');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), cast: [{ ...c, role: { why: 'x', extra: 'y' } }] }).success, false, 'role is strict');
});

test('Mirrors: cast feeds npcIds, the main place feeds placeId; a legacy edit wins and keeps roles and notes', () => {
  const emil = { ...newCast('npc-emil', id()), role: { ...newCast('x').role, knows: 'GEHEIM' } }, avi = newCast('npc-avi', id());
  const doc = scene({ npcIds: ['alt'], placeId: 'alt-ort', cast: [emil, avi], places: [{ ...newPlace('ort-lager', id()), note: 'kalt' }, { ...newPlace('ort-gang', id()), main: true }] });
  const mirrored = withWorkshopMirrors(doc);
  assert.deepEqual(mirrored.npcIds, ['npc-emil', 'npc-avi']);
  assert.equal(mirrored.placeId, 'ort-gang');
  assert.equal(withWorkshopMirrors({ ...doc, places: doc.places.map(p => ({ ...p, main: false })) }).placeId, '', 'no main place, no central place');
  const legacy = withWorkshopMirrors({ ...mirrored, npcIds: ['npc-emil', 'npc-neu'] }, mirrored);
  assert.deepEqual(legacy.cast.map(x => x.npcId), ['npc-emil', 'npc-neu']);
  assert.equal(legacy.cast[0].role.knows, 'GEHEIM', 'role of a kept NPC stays');
  const moved = withWorkshopMirrors({ ...mirrored, placeId: 'ort-lager' }, mirrored);
  assert.deepEqual(moved.places.map(p => [p.placeId, p.main, p.note]), [['ort-lager', true, 'kalt'], ['ort-gang', false, '']]);
  const cleared = withWorkshopMirrors({ ...mirrored, placeId: '' }, mirrored);
  assert.equal(cleared.places.length, 2, 'clearing the central place keeps the scene places');
  assert.equal(cleared.places.some(p => p.main), false);
  const added = withWorkshopMirrors({ ...mirrored, placeId: 'ort-neu' }, mirrored);
  assert.equal(added.places[0].placeId, 'ort-neu');
  assert.equal(added.places[0].main, true);
});

test('Conversion: selected NPCs become cast members, the central place the main scene place', () => {
  const old = scene({ npcIds: ['npc-a', 'npc-b'], placeId: 'ort' });
  const ws = toWorkshop(old, id);
  assert.deepEqual(ws.cast.map(c => c.npcId), ['npc-a', 'npc-b']);
  assert.deepEqual(ws.places.map(p => [p.placeId, p.main]), [['ort', true]]);
  assert.deepEqual(withWorkshopMirrors(ws).npcIds, old.npcIds, 'converting changes nothing for the current Regie');
  assert.equal(withWorkshopMirrors(ws).placeId, old.placeId);
});

test('Takeover of classic elements only on request, without losing the text', () => {
  const person = element('person', { title: 'Emil', text: rich('verängstigt'), referenceId: 'npc-emil' });
  const dialogue = element('dialogue', { title: 'Emil spricht', text: rich('„Bitte nicht …“') });
  const place = element('place', { title: 'Lager', text: rich('Schlafnische hinten'), referenceId: 'ort-lager' });
  const withFile = element('person', { referenceId: 'npc-emil', fileId: 'datei' });
  const doc = scene({ elements: [person, dialogue, place, withFile] });
  const offer = takeoverElements(doc, new Set(['npc-emil']), new Set(['ort-lager']));
  assert.deepEqual([offer.persons.length, offer.dialogues.length, offer.places.length], [1, 1, 1], 'elements with files stay classic');
  const a = takeOverPerson(doc, person.id, id);
  assert.equal(a.cast[0].role.why, 'Emil: verängstigt');
  assert.equal(a.elements.some(e => e.id === person.id), false);
  const b = takeOverDialogue(a, dialogue.id, a.cast[0].id);
  assert.equal(b.cast[0].dialogue, 'Emil spricht: „Bitte nicht …“');
  const c = takeOverPlace(b, place.id, id);
  assert.deepEqual([c.places[0].placeId, c.places[0].main, c.places[0].note], ['ort-lager', true, 'Lager: Schlafnische hinten']);
  assert.equal(c.elements.length, 1);
  assert.equal(takeOverDialogue(c, 'missing', c.cast[0].id), c);
  assert.equal(castHasContent(newCast('x')), false);
  assert.equal(castHasContent(c.cast[0]), true);
});

test('Rollback keeps roles and place notes as text; mirrors hold npcIds and placeId', () => {
  const doc = withWorkshopMirrors(scene({ cast: [{ ...newCast('npc-emil', id()), role: { ...newCast('x').role, intervenes: 'bei Bedrohung' }, cardNote: 'zittert' }], places: [{ ...newPlace('ort-gang', id()), main: true, unlockable: true, note: 'Sarg' }], placesOpen: true }));
  const { document, changed } = sceneWithoutWorkshop(doc);
  assert.equal(changed, true);
  assert.equal('cast' in document || 'places' in document || 'placesOpen' in document, false);
  assert.deepEqual(document.npcIds, ['npc-emil']);
  assert.equal(document.placeId, 'ort-gang');
  assert.match(document.gmNotes, /greift ein, wenn: bei Bedrohung/);
  assert.match(document.gmNotes, /Zusatz Spieler-Karte: zittert/);
  assert.match(document.gmNotes, /Hauptschauplatz · freischaltbar · Sarg/);
  assert.match(document.gmNotes, /im Spiel bestimmt/);
  assert.equal(sceneDocumentSchema.safeParse(document).success, true);
});
