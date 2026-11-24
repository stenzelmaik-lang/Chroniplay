// Spielbox: public mini games without login. Results stay in the browser (localStorage).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as R from '../app/spielbox/local-results.js';
import {SPIELE, spielbar} from '../app/spielbox/katalog.js';
import {cubeAfter, invertSequence, scramble} from '../app/spielbereich/modules/spieltisch/spielpause/cube-moves.js';

const lies = pfad => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    data,
  };
}

test('an empty or missing browser storage gives an empty leaderboard', () => {
  assert.deepEqual(R.readResults('rubik', memoryStorage()), []);
});

test('broken stored data does not break the page', () => {
  const storage = memoryStorage({[R.storageKey('rubik')]: '{kaputt'});
  assert.deepEqual(R.readResults('rubik', storage), []);
  storage.setItem(R.storageKey('rubik'), JSON.stringify([{timeMs: -5, moves: 3}, {timeMs: 'x'}, null, {timeMs: 1200, moves: 20}]));
  assert.deepEqual(R.readResults('rubik', storage), [{timeMs: 1200, moves: 20}]);
});

test('results are sorted best first: time, then moves', () => {
  const storage = memoryStorage();
  const at = new Date('2026-11-24T10:00:00Z');
  R.addResult('rubik', {timeMs: 90_000, moves: 80}, storage, at);
  R.addResult('rubik', {timeMs: 60_000, moves: 70}, storage, at);
  const list = R.addResult('rubik', {timeMs: 60_000, moves: 50}, storage, at);
  assert.deepEqual(list.map(r => [r.timeMs, r.moves]), [[60_000, 50], [60_000, 70], [90_000, 80]]);
  assert.equal(list[0].createdAt, '2026-11-24T10:00:00.000Z');
  assert.deepEqual(R.readResults('rubik', storage), list, 'the list survives a reload');
});

test('only the best ten results are kept', () => {
  const storage = memoryStorage();
  for (let i = 15; i >= 1; i--) R.addResult('rubik', {timeMs: i * 1000, moves: i}, storage);
  const list = R.readResults('rubik', storage);
  assert.equal(list.length, R.MAX_RESULTS);
  assert.equal(list[0].timeMs, 1000);
  assert.equal(list.at(-1).timeMs, 10_000);
});

test('invalid results are refused instead of stored', () => {
  const storage = memoryStorage();
  assert.throws(() => R.addResult('rubik', {timeMs: 1.5, moves: 3}, storage));
  assert.throws(() => R.addResult('rubik', {timeMs: 1000}, storage));
  assert.equal(storage.data.size, 0);
});

test('games are stored separately and can be deleted one by one', () => {
  const storage = memoryStorage();
  R.addResult('rubik', {timeMs: 5000, moves: 30}, storage);
  R.addResult('vier-gewinnt', {timeMs: 9000, moves: 12}, storage);
  R.clearResults('rubik', storage);
  assert.deepEqual(R.readResults('rubik', storage), []);
  assert.equal(R.readResults('vier-gewinnt', storage).length, 1);
  assert.throws(() => R.storageKey('../anderes'), /Unbekanntes Spiel/);
});

test('a browser that blocks storage still lets you play', () => {
  const blocked = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }};
  assert.deepEqual(R.readResults('rubik', blocked), []);
  assert.throws(() => R.addResult('rubik', {timeMs: 1000, moves: 5}, blocked));
  assert.doesNotThrow(() => R.clearResults('rubik', blocked));
});

test('the service has the shape the Spielpause runtime expects', async () => {
  const storage = memoryStorage();
  const service = R.localResultService('rubik', storage);
  assert.deepEqual(await service.loadResults(), []);
  const saved = await service.saveResult({game: 'rubik', timeMs: 4321, moves: 25, fremd: 'x'});
  assert.equal(saved.length, 1);
  assert.equal(saved[0].fremd, undefined, 'only time, moves and date are stored');
  assert.deepEqual(await service.loadResults(), saved);
});

test('the Spielbox uses the very same cube logic as the Spielpause (scramble and back solves it)', () => {
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const mix = scramble(22, random);
  assert.equal(cubeAfter(mix).isSolved(), false);
  assert.equal(cubeAfter([...mix, ...invertSequence(mix)]).isSolved(), true);
});

test('catalog: the cube is playable, Vier gewinnt comes next, the rest is planned', () => {
  assert.deepEqual(SPIELE.map(s => s.id), ['rubik', 'vier-gewinnt', 'mau-mau', 'schiffe-versenken']);
  assert.equal(spielbar('rubik'), true);
  assert.equal(spielbar('vier-gewinnt'), false);
  assert.equal(SPIELE.find(s => s.id === 'vier-gewinnt').stand, 'als Nächstes');
});

test('the Spielbox page needs no login and sends nothing to the server', () => {
  const sources = ['app/spielbox/page.tsx', 'app/spielbox/spielbox.tsx', 'app/spielbox/local-results.js'].map(lies).join('\n');
  assert.doesNotMatch(sources, /platform-auth|currentUser|@\/server\/|fetch\(|\/api\//);
  assert.match(lies('app/spielbox/spielbox.tsx'), /services=\{rubikResults\}/, 'browser-only results are passed to the toy table');
});

test('the landing page links to the Spielbox', () => {
  assert.match(lies('app/visitor/visitor-shell.tsx'), /label: "Spielbox", href: "\/spielbox"/);
});
