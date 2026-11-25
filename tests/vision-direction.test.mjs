// Vision Engine: Regiespur, Ablaufplan, Umwandlung bestehender Visionen, Projektion zum Spieler, Wortmomente der Engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {visionDirectionSchema, visionPlan, directionFragments, directionHasText, AUTO_PLACES} from '../domain/vision-direction.ts';
import {directionFromEntry} from '../domain/vision-direction-convert.ts';
import {sceneWhisperSchema} from '../domain/story-scene.ts';
import {playerDeliveries} from '../domain/personal-delivery.ts';
import {buildTimeline, frameAt} from '../app/spielbereich/modules/vision-engine/timeline.js';

const uuid = () => crypto.randomUUID();
const whisper = extra => ({id: uuid(), kind: 'vision', title: 'Der Hunger folgt dir', text: '', recipientIds: [], fileIds: [], ...extra});

test('Regiespur: gültige Werte werden angenommen, alles andere abgelehnt', () => {
  const ok = {v: 1, intensity: 'strong', filter: 0.4, intro: 'Regen.', finale: 'Der Hunger folgt dir.', shots: [{fileId: 'f1', focus: {x: 0.6, y: 0.42}, core: 0.38, size: 'nah', place: 'rechts', text: 'Du läufst.', echo: 'läufst', holdMs: 4000}]};
  assert.equal(visionDirectionSchema.safeParse(ok).success, true);
  for (const bad of [
    {...ok, v: 2},
    {...ok, extra: true},
    {...ok, shots: [{fileId: 'f1', core: 0.9}]},
    {...ok, shots: [{fileId: 'f1', focus: {x: 1.4, y: 0}}]},
    {...ok, shots: [{fileId: 'f1'}, {fileId: 'f1'}]},
    {...ok, shots: [{fileId: 'f1', place: 'oben'}]},
    {...ok, intro: 'x'.repeat(601)},
  ]) assert.equal(visionDirectionSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 80));
});

test('Szenenformat: Visionen mit und ohne Regiespur bleiben gültig', () => {
  assert.equal(sceneWhisperSchema.safeParse(whisper({fileIds: ['a'], fragments: ['Text']})).success, true);
  assert.equal(sceneWhisperSchema.safeParse(whisper({fileIds: ['a'], direction: {v: 1, shots: [{fileId: 'a', text: 'Text'}]}})).success, true);
  assert.equal(sceneWhisperSchema.safeParse(whisper({direction: {v: 1, shots: [{fileId: 'a', core: 2}]}})).success, false);
});

test('Ablauf ohne Regiespur: Bilder und Texte wie bisher verteilt, nichts geht verloren', () => {
  const p = visionPlan({preset: 'echo', tempo: 'normal', images: ['a', 'b', 'c', 'd', 'e'], fragments: ['T1', 'T2', 'T3'], audioFileId: null});
  assert.deepEqual(p.moments.map(m => m.image), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(p.moments.map(m => m.text), ['T1', '', 'T2', '', 'T3']);
  assert.deepEqual(p.moments.map(m => m.place), ['rechts', 'links', 'mitte', 'rechts', 'links']);
  const q = visionPlan({preset: 'dark', tempo: 'calm', images: ['a', 'b'], fragments: ['T1', 'T2', 'T3', 'T4'], audioFileId: 's'});
  assert.deepEqual(q.moments.filter(m => m.image).map(m => m.image), ['a', 'b']);
  assert.deepEqual(q.moments.map(m => m.text).filter(Boolean), ['T1', 'T2', 'T3', 'T4']);
  assert.equal(q.audioFileId, 's');
});

test('Ablauf mit Regiespur: Reihenfolge der Bilder, Einstellungen je Datei, fremde Einträge ignoriert', () => {
  const direction = {v: 1, intro: 'Regen.', finale: 'Ende.', intensity: 'soft', filter: 0.2, shots: [
    {fileId: 'b', text: 'Zwei', place: 'links', size: 'weit', core: 0.4, focus: {x: 0.2, y: 0.3}, echo: 'Zwei', holdMs: 3000},
    {fileId: 'a', text: 'Eins'}, {fileId: 'fremd', text: 'nicht dabei'},
  ]};
  const p = visionPlan({preset: 'echo', tempo: 'normal', images: ['a', 'b'], fragments: ['wird ignoriert'], audioFileId: null, direction});
  assert.deepEqual(p.moments.map(m => [m.image, m.text]), [['a', 'Eins'], ['b', 'Zwei']]);
  assert.equal(p.moments[1].place, 'links'); assert.equal(p.moments[1].size, 'weit'); assert.equal(p.moments[1].echo, 'Zwei'); assert.equal(p.moments[1].holdMs, 3000);
  assert.equal(p.moments[0].place, AUTO_PLACES[0]);
  assert.equal(p.intro, 'Regen.'); assert.equal(p.finale, 'Ende.'); assert.equal(p.intensity, 'soft'); assert.equal(p.filter, 0.2);
  assert.deepEqual(directionFragments(direction, ['a', 'b']), ['Regen.', 'Eins', 'Zwei', 'Ende.']);
  // Regiespur ohne eigene Texte: Textabschnitte bleiben maßgeblich
  const empty = {v: 1, shots: [{fileId: 'a', place: 'links'}]};
  assert.equal(directionHasText(empty), false);
  const r = visionPlan({preset: 'echo', tempo: 'normal', images: ['a'], fragments: ['Alt'], audioFileId: null, direction: empty});
  assert.equal(r.moments[0].text, 'Alt'); assert.equal(r.moments[0].place, 'links');
});

test('Umwandlung: Eintauchen, Bildtexte und Schlusssatz aus einer bestehenden Vision, ohne Textverlust', () => {
  const w = whisper({fileIds: ['a', 'b'], fragments: ['Vor allem', 'Zu A', 'Dazwischen', 'Zu B', 'Danach']});
  const d = directionFromEntry(w);
  assert.equal(visionDirectionSchema.safeParse(d).success, true);
  const all = [d.intro, ...d.shots.map(s => s.text), d.finale].join(' ');
  for (const t of w.fragments) assert.ok(all.includes(t), t);
  assert.deepEqual(d.shots.map(s => s.fileId), ['a', 'b']);
  const onlyText = directionFromEntry(whisper({fragments: ['Nur Worte']}));
  assert.equal(onlyText.intro, 'Nur Worte'); assert.deepEqual(onlyText.shots, []);
});

test('Spielerprojektion: Regiespur nur bei Visionen, ohne interne Felder', () => {
  const direction = {v: 1, shots: [{fileId: 'a', text: 'Eins'}]};
  const base = {whisperId: 'w', sceneId: 's', sceneVersion: 1, preset: 'echo', layout: 'fax', title: 'INTERN', sender: '', fragments: ['Eins'], html: '', imageFileIds: ['a'], audioFileId: null, recipients: ['p1'], createdAt: '2026-11-25T10:00:00.000Z', createdBy: 'gm', withdrawnAt: null, receipts: {}};
  const [vision, letter] = playerDeliveries([{...base, id: 'r1', kind: 'vision', direction}, {...base, id: 'r2', kind: 'letter', direction, createdAt: '2026-11-25T10:01:00.000Z'}], 'p1');
  assert.deepEqual(vision.direction, direction);
  assert.equal(letter.direction, undefined);
  assert.equal(JSON.stringify(vision).includes('INTERN'), false);
});

test('Engine: Wortmomente ohne Bild stehen im Ablauf, Bildebenen wechseln nur zwischen Bildern', () => {
  const tl = buildTimeline({type: 'echo', tempo: 'normal', moments: [{text: 'Erst Worte'}, {image: 'a.jpg', text: 'Bild A'}, {text: 'Dazwischen'}, {image: 'b.jpg', text: 'Bild B'}]});
  assert.equal(tl.moments.length, 4);
  assert.deepEqual(tl.moments.map(m => m.image), [false, true, false, true]);
  assert.deepEqual(tl.moments.filter(m => m.image).map(m => m.slot), [0, 1]);
  for (let i = 1; i < tl.moments.length; i++) assert.ok(tl.moments[i].emergeStart >= tl.moments[i - 1].dissolveStart - 1);
  assert.deepEqual(tl.texts.map(x => x.text), ['Erst Worte', 'Bild A', 'Dazwischen', 'Bild B']);
  const seen = new Set();
  for (let t = 0; t <= tl.duration; t += 50) for (const s of frameAt(tl, t).slots) if (s && s.reveal > 0.5) seen.add(s.moment);
  assert.deepEqual([...seen].sort(), [1, 3]);
});
