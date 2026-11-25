// Regie-Tests des Vision-Engine-Prototyps (ohne Browser).
// node --test prototypes/vision-engine/timeline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTimeline, frameAt, nextStop, echoIndices, readingMs, FLASH_MIN_GAP_MS, flashEnvelope} from '../../app/spielbereich/modules/vision-engine/timeline.js';
import {VISION_TYPES, typeById} from '../../app/spielbereich/modules/vision-engine/presets.js';
import {layoutMoment} from '../../app/spielbereich/modules/vision-engine/layout.js';
import {defaultVision, toSceneWhisper} from './src/vision-default.js';

const v = defaultVision();

test('alle fünf Bilder erscheinen genau einmal und in Reihenfolge', () => {
  for (const type of VISION_TYPES) {
    const tl = buildTimeline(v, {type: type.id});
    assert.equal(tl.moments.length, 5, type.id);
    for (let i = 1; i < 5; i++) assert.ok(tl.moments[i].emergeStart >= tl.moments[i - 1].emergeStart, type.id);
    const seen = new Set();
    for (let t = 0; t <= tl.duration; t += 50) for (const s of frameAt(tl, t).slots) if (s && s.reveal > 0.5 && s.dissolve < 0.5) seen.add(s.moment);
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4], type.id);
  }
});

test('jedes Bild ist mindestens 2,6 s vollständig sichtbar und Text bekommt seine Lesezeit', () => {
  for (const type of VISION_TYPES) for (const tempo of ['calm', 'normal', 'brisk']) {
    const tl = buildTimeline(v, {type: type.id, tempo});
    for (const m of tl.moments) assert.ok(m.hold >= 2600, `${type.id}/${tempo} hold ${m.hold}`);
    for (const x of tl.texts.filter(x => x.role === 'fragment')) {
      const need = readingMs(x.text, type, tl.tempo.factor);
      assert.ok(x.outAt - (x.inAt + tl.textEnter) >= need - 1, `${type.id}/${tempo} ${x.key}`);
    }
  }
});

test('Ablauf: Eintauchen vor dem ersten Bild, Schlusssatz bleibt bis zum Ende', () => {
  const tl = buildTimeline(v);
  const intro = tl.texts.find(x => x.key === 'intro');
  const final = tl.texts.find(x => x.key === 'final');
  assert.ok(intro.outAt < tl.moments[0].emergeStart + 1);
  assert.equal(final.outAt, Infinity);
  assert.ok(frameAt(tl, tl.duration).texts.some(x => x.key === 'final'));
});

test('Lichtimpulse: nur bei bedrohlich/dramatisch, Abstand ≥ 2,5 s, im Ruhemodus keine', () => {
  for (const type of VISION_TYPES) {
    const tl = buildTimeline(v, {type: type.id});
    const flashes = tl.moments.filter(m => m.flashAt !== null).map(m => m.flashAt);
    if (!type.flashes) assert.equal(flashes.length, 0, type.id);
    for (let i = 1; i < flashes.length; i++) assert.ok(flashes[i] - flashes[i - 1] >= FLASH_MIN_GAP_MS, type.id);
    const red = buildTimeline(v, {type: type.id, reduced: true});
    assert.equal(red.moments.filter(m => m.flashAt !== null).length, 0, type.id + ' reduziert');
    for (let t = 0; t <= red.duration; t += 40) assert.equal(frameAt(red, t).flash, 0);
  }
  // Hüllkurve: Anstieg nicht schneller als 140 ms
  assert.equal(flashEnvelope(-200), 0);
  assert.ok(flashEnvelope(-70) > 0 && flashEnvelope(-70) < 1);
});

test('Zustandswerte bleiben im gültigen Bereich', () => {
  for (const type of VISION_TYPES) {
    const tl = buildTimeline(v, {type: type.id});
    for (let t = 0; t <= tl.duration; t += 33) {
      const f = frameAt(tl, t);
      for (const k of ['presence', 'master', 'heart', 'muffle']) assert.ok(f[k] >= 0 && f[k] <= 1, `${type.id} ${k} @${t}`);
      for (const s of f.slots) if (s) for (const k of ['reveal', 'dissolve', 'trans']) assert.ok(s[k] >= 0 && s[k] <= 1);
    }
  }
});

test('„Weiter“ springt nur vorwärts und endet am Schluss', () => {
  const tl = buildTimeline(v);
  let t = 0, guard = 0;
  while (t < tl.duration && guard++ < 100) { const n = nextStop(tl, t); assert.ok(n > t); t = n; }
  assert.equal(t, tl.duration);
});

test('Nachhall wird im Satz gefunden, sonst als eigenes Wort angelegt', () => {
  assert.deepEqual(echoIndices('Sie geht an dir vorbei. Du hörst ihr Herz, lauter als den Regen.', 'ihr Herz'), [7, 8]);
  assert.deepEqual(echoIndices('Du läufst schneller, ohne zu wissen, wovor.', 'Wovor'), [6]);
  assert.deepEqual(echoIndices('Brot. Wasser.', 'Gestern'), []);
  const tl = buildTimeline({...v, moments: [{...v.moments[0], echo: 'Regen'}]});
  assert.ok(tl.texts.some(x => x.role === 'echo' && x.text === 'Regen'));
});

test('Kernbereich bleibt auf Desktop, Tablet und Handy vollständig sichtbar', () => {
  const img = {width: 1448, height: 1086};
  for (const view of [{w: 1920, h: 1080}, {w: 1440, h: 810}, {w: 1024, h: 768}, {w: 768, h: 1024}, {w: 390, h: 844}, {w: 360, h: 640}]) {
    for (const m of v.moments) {
      const L = layoutMoment(view, img, m);
      assert.ok(L.focus.x - L.coreR >= -0.5 && L.focus.x + L.coreR <= view.w + 0.5, `${view.w}x${view.h} ${m.id} x`);
      assert.ok(L.focus.y - L.coreR >= -0.5 && L.focus.y + L.coreR <= view.h + 0.5, `${view.w}x${view.h} ${m.id} y`);
      assert.ok(L.inner >= L.coreR, 'Maske deckt den Kern');
      if (L.portrait) assert.ok(L.focus.y + L.coreR <= view.h * 0.6 + 0.5, 'Handy: Kern oberhalb der Worte');
    }
  }
});

test('Abbildung auf das bestehende Szenenformat bleibt in dessen Grenzen', () => {
  const w = toSceneWhisper(v);
  assert.equal(w.preset, 'echo');
  assert.equal(w.fileIds.length, 5);
  assert.ok(w.fragments.length <= 20 && w.fragments.every(f => f.length <= 600));
  assert.equal(w.direction.moments.length, 5);
  assert.ok(['classic', 'dream', 'dark', 'threat', 'drama', 'echo'].includes(typeById(w.preset).id));
});
