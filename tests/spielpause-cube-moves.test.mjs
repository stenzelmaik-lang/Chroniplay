// Rubik cube notation, inverse turns, scramble/undo, timer and gesture rules (Spielpause).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CubeModel, FACE_MOVES} from '../app/spielbereich/modules/spieltisch/spielpause/toys-core.js';
import * as M from '../app/spielbereich/modules/spieltisch/spielpause/cube-moves.js';

const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('there are exactly twelve basic turns: six faces, each forward and backward', () => {
  assert.equal(M.BASIC_MOVES.length, 12);
  assert.deepEqual(M.BASIC_MOVES.slice(0, 4), ['U', 'U′', 'D', 'D′']);
  const keys = new Set(M.BASIC_MOVES.map(name => JSON.stringify(M.parseMove(name))));
  assert.equal(keys.size, 12, 'all twelve turns are different');
});

test('every basic turn followed by its inverse gives the start state', () => {
  for (const name of M.BASIC_MOVES) {
    const cube = new CubeModel(), start = cube.fingerprint();
    const move = M.parseMove(name);
    cube.apply(move);
    assert.notEqual(cube.fingerprint(), start, name + ' changes the cube');
    assert.ok(!cube.isSolved(), name + ' unsolves the cube');
    cube.apply(M.invertMove(move));
    assert.equal(cube.fingerprint(), start, name + ' then inverse');
  }
});

test('X followed by X′ is the identity, and X′ is the same as X three times', () => {
  for (const face of [...M.BASE_FACES, ...M.SLICES]) {
    const a = M.cubeAfter(M.parseSequence(face + ' ' + face + "'"));
    assert.ok(a.isSolved(), face);
    assert.equal(M.cubeAfter([M.parseMove(face + '′')]).fingerprint(), M.cubeAfter(M.parseSequence([face, face, face].join(' '))).fingerprint(), face + '′ = ' + face + '³');
    assert.equal(M.cubeAfter([M.parseMove(face + '2')]).fingerprint(), M.cubeAfter(M.parseSequence(face + ' ' + face)).fingerprint(), face + '2');
  }
});

test('clockwise is seen from the face itself: U moves the front row to the left side', () => {
  const cube = M.cubeAfter([M.parseMove('U')]);
  // After U, the sticker that was on the front of the top-front-centre edge now faces left.
  const edge = cube.cubies.find(c => c.id === '0,1,1');
  assert.deepEqual(edge.position, [-1, 1, 0]);
  assert.deepEqual(edge.stickers.find(s => s.color === 'F').normal, [-1, 0, 0]);
  // After R, the front-right edge goes up.
  const r = M.cubeAfter([M.parseMove('R')]).cubies.find(c => c.id === '1,0,1');
  assert.deepEqual(r.position, [1, 1, 0]);
  // After F, the top-front edge goes right.
  const f = M.cubeAfter([M.parseMove('F')]).cubies.find(c => c.id === '0,1,1');
  assert.deepEqual(f.position, [1, 0, 1]);
});

test('a scramble followed by the reversed, inverted move list is solved', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const moves = M.scramble(25, seeded(seed));
    const cube = M.cubeAfter(moves);
    assert.ok(!cube.isSolved(), 'scramble ' + seed + ' is mixed');
    M.applySequence(cube, M.invertSequence(moves));
    assert.ok(cube.isSolved(), 'scramble ' + seed + ' undone');
    assert.equal(cube.fingerprint(), new CubeModel().fingerprint());
  }
});

test('undo step by step (as the undo button does) also returns to solved', () => {
  const history = M.scramble(30, seeded(77));
  const cube = M.cubeAfter(history);
  while (history.length) cube.apply(M.invertMove(history.pop()));
  assert.ok(cube.isSolved());
});

test('scramble uses face turns only and never the same axis twice in a row', () => {
  const moves = M.scramble(200, seeded(5));
  moves.forEach((move, index) => {
    assert.ok(M.isValidMove(move));
    assert.ok(move.layer !== 0, 'no middle slices in a scramble');
    if (index) assert.notEqual(move.axis, moves[index - 1].axis);
  });
  assert.equal(M.scramble(22, () => 0.9999999).length, 22, 'edge of the random range stays valid');
});

test('notation round-trips and refuses unknown turns', () => {
  const text = "R U R′ U′ F2 M E′ S";
  assert.equal(M.formatSequence(M.parseSequence(text)), text);
  assert.equal(M.formatMove(M.parseMove("L'")), 'L′');
  assert.equal(M.formatMove({...FACE_MOVES.U, quarter: 4}), '');
  for (const bad of ['X', 'U3', "U''", '', 'u']) assert.throws(() => M.parseMove(bad), bad);
  assert.equal(M.isValidMove({axis: 3, layer: 0, quarter: 1}), false);
});

test('(R U R′ U′) six times and the sexy-move inverse are identities', () => {
  assert.ok(M.cubeAfter(M.parseSequence(Array(6).fill("R U R' U'").join(' '))).isSolved());
  const seq = M.parseSequence("R U R' U' F' L2 B D'");
  assert.ok(M.applySequence(M.cubeAfter(seq), M.invertSequence(seq)).isSolved());
});

test('timer starts with the first own turn, stops once when solved, ignores turns before arming', () => {
  const timer = new M.SolveTimer();
  timer.countMove(100);
  assert.equal(timer.state, 'idle', 'no clock without a scramble');
  timer.arm();
  assert.equal(timer.elapsed(5000), 0);
  timer.countMove(1000);
  assert.equal(timer.state, 'running');
  timer.countMove(1500); timer.countUndo(1800);
  assert.equal(timer.elapsed(2000), 1000);
  assert.deepEqual(timer.solved(13345.6), {timeMs: 12346, moves: 3});
  assert.equal(timer.solved(20000), null, 'reports only once');
  assert.equal(timer.elapsed(99999), 12345.6);
  timer.cancel();
  assert.equal(timer.state, 'stopped', 'a finished result is not cancelled');
  const other = new M.SolveTimer(); other.arm(); other.countMove(0); other.cancel();
  assert.equal(other.state, 'idle');
});

test('time format: hundredths, minutes only when needed', () => {
  assert.equal(M.formatTime(0), '0,00');
  assert.equal(M.formatTime(23456), '23,45');
  assert.equal(M.formatTime(83456), '1:23,45');
  assert.equal(M.formatTime(3_600_000), '60:00,00');
});

test('gesture: short or diagonal drags turn nothing, clear drags pick one layer', () => {
  const candidates = [{axis: 0, score: 0.95}, {axis: 1, score: 0.3}];
  assert.equal(M.chooseSwipe(candidates, 6), null, 'too short');
  assert.equal(M.chooseSwipe(candidates, 20).axis, 0);
  assert.equal(M.chooseSwipe([{axis: 0, score: 0.71}, {axis: 1, score: 0.70}], 30), null, 'diagonal waits');
  assert.equal(M.chooseSwipe([{axis: 0, score: 0.4}, {axis: 1, score: 0.1}], 30), null, 'weak alignment waits');
});

test('release: a small nudge snaps back, a third of the way or a flick commits', () => {
  const q = Math.PI / 2;
  assert.equal(M.releaseQuarter(q * 0.2), 0);
  assert.equal(M.releaseQuarter(q * 0.4), 1);
  assert.equal(M.releaseQuarter(-q * 0.5), -1);
  assert.equal(M.releaseQuarter(q * 0.15, 8), 1, 'flick');
  assert.equal(M.releaseQuarter(q * 0.15, -8), 0, 'flick against the drag does nothing');
  assert.equal(M.releaseQuarter(q * 0.05, 20), 0, 'tiny accidental flick does nothing');
});

test('ranking order: faster first, then fewer moves', () => {
  const list = [{timeMs: 5000, moves: 40}, {timeMs: 4000, moves: 60}, {timeMs: 4000, moves: 50}];
  assert.deepEqual(list.sort(M.compareResults).map(r => r.moves), [50, 60, 40]);
});
