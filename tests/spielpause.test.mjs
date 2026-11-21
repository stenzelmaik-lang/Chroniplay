// Physical state and friction checks adapted from the supplied playground verifier.
import assert from 'node:assert/strict';
import {test as check} from 'node:test';
import * as T from '../app/spielbereich/modules/spieltisch/spielpause/toys-core.js';
function physicalCube(cube) {
  assert.equal(cube.cubies.length, 26);
  assert.equal(new Set(cube.cubies.map(c => c.position.join(','))).size, 26);
  const colors = {};
  let total = 0;
  for (const cubie of cube.cubies) {
    assert.ok(cubie.position.every(v => [-1, 0, 1].includes(v)));
    for (const sticker of cubie.stickers) {
      assert.equal(sticker.normal.reduce((sum, v) => sum + Math.abs(v), 0), 1);
      assert.equal(cubie.position[sticker.normal.findIndex(Boolean)], sticker.normal.find(Boolean));
      colors[sticker.color] = (colors[sticker.color] || 0) + 1; total++;
    }
  }
  assert.equal(total, 54);
  assert.deepEqual(Object.values(colors), [9, 9, 9, 9, 9, 9]);
}

check('54 Sticker, 26 Steine, sechs Farben und gelöster Ausgangszustand', () => {
  const cube = new T.CubeModel(); physicalCube(cube); assert.ok(cube.isSolved());
});
check('Jede der neun Ebenen dreht physikalisch korrekt und kehrt nach vier Drehungen zurück', () => {
  for (const move of Object.values(T.FACE_MOVES)) {
    const cube = new T.CubeModel(), initial = cube.fingerprint();
    cube.apply(move); physicalCube(cube); assert.ok(!cube.isSolved());
    cube.apply(T.inverseMove(move)); assert.equal(cube.fingerprint(), initial);
    for (let turn = 0; turn < 4; turn++) cube.apply(move);
    assert.equal(cube.fingerprint(), initial);
  }
});
check('R U R′ U′ sechsmal ergibt exakt den Ausgangszustand', () => {
  const cube = new T.CubeModel(), initial = cube.fingerprint();
  for (let i = 0; i < 6; i++) {
    for (const move of [T.FACE_MOVES.R, T.FACE_MOVES.U, T.inverseMove(T.FACE_MOVES.R), T.inverseMove(T.FACE_MOVES.U)]) cube.apply(move);
  }
  assert.equal(cube.fingerprint(), initial);
});
check('1.000 gemischte Außen- und Mitteldrehungen lassen sich vollständig rückgängig machen', () => {
  const cube = new T.CubeModel(), initial = cube.fingerprint(), sequence = [];
  let seed = 143;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const moves = Object.values(T.FACE_MOVES);
  for (let i = 0; i < 1000; i++) {
    const base = moves[Math.floor(random() * moves.length)];
    const move = { ...base, quarter: [-2, -1, 1, 2][Math.floor(random() * 4)] };
    sequence.push(move); cube.apply(move); physicalCube(cube);
  }
  for (const move of sequence.reverse()) cube.apply(T.inverseMove(move));
  assert.equal(cube.fingerprint(), initial);
});
check('Mischen bleibt auch mit deterministischer Zufallsquelle endlich und gültig', () => {
  const sequence = T.scrambleMoves(22, () => 0);
  assert.equal(sequence.length, 22);
  sequence.forEach((move, index) => { if (index) assert.notEqual(move.axis, sequence[index - 1].axis); });
});
check('Gedrückthalten zählt einmal; Quetschen und Rückfedern bleiben stabil', () => {
  const doll = new T.SqueezeModel(); assert.ok(doll.press()); assert.equal(doll.press(), false);
  for (let i = 0; i < 240; i++) doll.step(1 / 60);
  assert.equal(doll.count, 1); assert.ok(doll.value > 0.85 && doll.value < 1);
  doll.release();
  for (let i = 0; i < 500; i++) doll.step(1 / 60);
  assert.ok(Math.abs(doll.value) < 0.00001); assert.ok(Math.abs(doll.velocity) < 0.0001);
  doll.press(); doll.step(1 / 60, true); assert.equal(doll.count, 2); assert.ok(doll.value > 0.6);
  doll.release(); doll.step(1 / 60, true); assert.equal(doll.value, 0);
});
check('Spinner läuft bei 30 und 120 Bildern gleich weit, bremst und stoppt', () => {
  const a = new T.SpinnerModel(), b = new T.SpinnerModel(); a.impulse(); b.impulse();
  for (let i = 0; i < 30 * 8; i++) a.step(1 / 30);
  for (let i = 0; i < 120 * 8; i++) b.step(1 / 120);
  assert.ok(Math.abs(a.turns - b.turns) < 0.00001);
  assert.ok(a.speed < 15 && a.speed > 0);
  assert.ok(a.turns > 5);
  a.stop(); const before = a.angle; a.step(1 / 60); assert.equal(a.angle, before);
  a.impulse(-1); assert.ok(a.speed < 0);
  assert.ok(Math.abs(T.angleDifference(-3.12, 3.12)) < 0.1);
});

// Live report 21.11.2026: the picker sat inside the isolated stage, below the HUD layer with the
// player's own vitals panel, so on smaller screens the choices were covered. It now renders into the HUD layer.
check('Spielpause picker renders above the player HUD and stays reachable on short screens', async () => {
  const {readFileSync} = await import('node:fs');
  const component = readFileSync(new URL('../app/spielbereich/modules/spieltisch/spielpause/spielpause.tsx', import.meta.url), 'utf8');
  const stage = readFileSync(new URL('../app/spielbereich/modules/spieltisch/stage.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/spielbereich/modules/spieltisch/spielpause/spielpause.module.css', import.meta.url), 'utf8');
  assert.match(component, /createPortal\(menu,pickerHost\)/);
  assert.match(stage, /<div ref=\{setHudLayer\}[^>]*className=\{styles\.hud\}>/);
  assert.match(stage, /<Spielpause open=\{pauseMenu\}.*pickerHost=\{hudLayer\}/);
  const picker = css.match(/\.picker\{[^}]*\}/)?.[0] || '';
  assert.match(picker, /pointer-events:auto/);
  assert.match(picker, /max-height:calc\(100% - 36px\)/);
  assert.match(picker, /overflow-y:auto/);
});
