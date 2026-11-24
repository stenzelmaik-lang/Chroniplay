/* ChroniPlay Spielpause: notation, timer and gesture rules for the Rubik cube.
 * Pure functions only, so undo, scramble, validation and the tests share one definition.
 * The twelve basic turns are U D L R F B, each clockwise (U) and counter-clockwise (U′),
 * as seen when looking straight at that face. M, E and S remain available as middle slices.
 */
import {FACE_MOVES, CubeModel} from './toys-core.js';

export const BASE_FACES = Object.freeze(['U', 'D', 'L', 'R', 'F', 'B']);
export const SLICES = Object.freeze(['M', 'E', 'S']);
/** The twelve basic turns in display order: U, U′, D, D′ … */
export const BASIC_MOVES = Object.freeze(BASE_FACES.flatMap(face => [face, face + '′']));
export const FACE_NAMES = Object.freeze({U:'Oben', D:'Unten', L:'Links', R:'Rechts', F:'Vorne', B:'Hinten', M:'Mitte senkrecht', E:'Mitte waagrecht', S:'Mitte vorne'});

const PRIME = /^['′’`]$/;

/** "U", "U'", "U′", "U2", "M'" → {axis, layer, quarter}. Throws on anything else. */
export function parseMove(token) {
  const text = String(token).trim();
  const face = text[0], suffix = text.slice(1);
  const base = FACE_MOVES[face];
  if (!base || suffix.length > 1) throw new Error('Unbekannter Zug: ' + text);
  let factor = 1;
  if (suffix === '2') factor = 2;
  else if (PRIME.test(suffix)) factor = -1;
  else if (suffix) throw new Error('Unbekannter Zug: ' + text);
  return {axis: base.axis, layer: base.layer, quarter: factor === 2 ? 2 : base.quarter * factor};
}

/** "R U R' U'" → move list. */
export function parseSequence(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).map(parseMove);
}

function normalQuarter(quarter) {
  const q = ((quarter % 4) + 4) % 4;
  return q === 3 ? -1 : q; // 0, 1, 2 or -1
}

/** Move → notation. Half turns are written "U2"; a full turn is an empty string. */
export function formatMove(move) {
  const entry = Object.entries(FACE_MOVES).find(([, base]) => base.axis === move.axis && base.layer === move.layer);
  if (!entry) throw new Error('Ungültige Würfeldrehung.');
  const [face, base] = entry;
  const q = normalQuarter(move.quarter), b = normalQuarter(base.quarter);
  if (q === 0) return '';
  if (q === 2) return face + '2';
  return face + (q === b ? '' : '′');
}

export function formatSequence(moves) {
  return moves.map(formatMove).filter(Boolean).join(' ');
}

export function invertMove(move) {
  return {axis: move.axis, layer: move.layer, quarter: -move.quarter};
}

/** The sequence that undoes `moves`: reversed order, every turn inverted. */
export function invertSequence(moves) {
  return moves.slice().reverse().map(invertMove);
}

export function isValidMove(move) {
  return !!move && Number.isInteger(move.axis) && move.axis >= 0 && move.axis <= 2 &&
    [-1, 0, 1].includes(move.layer) && [-2, -1, 1, 2].includes(move.quarter);
}

export function applySequence(cube, moves) {
  for (const move of moves) cube.apply(move);
  return cube;
}

/** A fresh cube with `moves` applied. Handy for validation and tests. */
export function cubeAfter(moves) {
  return applySequence(new CubeModel(), moves);
}

/** Random scramble of face turns only, never the same axis twice in a row. */
export function scramble(length = 22, random = Math.random) {
  const sequence = [];
  let previousAxis = -1;
  while (sequence.length < length) {
    const options = BASE_FACES.filter(face => FACE_MOVES[face].axis !== previousAxis);
    const face = options[Math.floor(random() * options.length) % options.length];
    const kind = ['', '′', '2'][Math.floor(random() * 3) % 3];
    const move = parseMove(face + kind);
    sequence.push(move);
    previousAxis = move.axis;
  }
  return sequence;
}

/* ---------- Timer: from the first own turn after a scramble until solved ---------- */

export class SolveTimer {
  constructor() { this.reset(); }
  reset() { this.state = 'idle'; this.startedAt = 0; this.stoppedAt = 0; this.moves = 0; }
  /** After a fresh scramble: ready, but the clock only starts with the first own turn. */
  arm() { this.reset(); this.state = 'armed'; }
  /** Call for every completed own turn (not for scramble or undo animations). */
  countMove(now) {
    if (this.state === 'armed') { this.state = 'running'; this.startedAt = now; }
    if (this.state === 'running') this.moves++;
  }
  /** Undo counts as a turn too: the clock keeps running and the solve stays honest. */
  countUndo(now) { this.countMove(now); }
  /** Returns the finished result once, when the cube is solved while the clock runs. */
  solved(now) {
    if (this.state !== 'running') return null;
    this.state = 'stopped'; this.stoppedAt = now;
    return {timeMs: Math.max(0, Math.round(now - this.startedAt)), moves: this.moves};
  }
  /** Abandon the attempt (reset, solve button, putting the toy away). */
  cancel() { if (this.state !== 'stopped') this.reset(); }
  elapsed(now) {
    if (this.state === 'running') return Math.max(0, now - this.startedAt);
    if (this.state === 'stopped') return this.stoppedAt - this.startedAt;
    return 0;
  }
}

/** 83456 → "1:23,45"; under a minute "23,45". */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 10));
  const hundredths = total % 100, seconds = Math.floor(total / 100) % 60, minutes = Math.floor(total / 6000);
  const tail = String(hundredths).padStart(2, '0');
  return minutes ? minutes + ':' + String(seconds).padStart(2, '0') + ',' + tail : seconds + ',' + tail;
}

/* ---------- Gesture rules: clear drag direction, no accidental turns ---------- */

/** The pointer must travel this far (in 420×370 canvas units) before anything turns. */
export const DRAG_START = 12;
/** The best direction must beat the second best by this factor, otherwise we wait for more movement. */
export const DRAG_DOMINANCE = 1.3;
/** Canvas units of drag for a full quarter turn while following the finger. */
export const DRAG_QUARTER = 110;

/**
 * Pick the layer to turn from candidate axes. `candidates` holds {score} with |cos| alignment
 * between the drag and each axis' on-screen direction. Returns the winning candidate or null when
 * the drag is still too short or too ambiguous (diagonal between two directions).
 */
export function chooseSwipe(candidates, distance) {
  if (distance < DRAG_START) return null;
  const sorted = candidates.filter(Boolean).slice().sort((a, b) => b.score - a.score);
  if (!sorted.length || sorted[0].score < 0.55) return null;
  if (sorted[1] && sorted[0].score < sorted[1].score * DRAG_DOMINANCE) return null;
  return sorted[0];
}

/**
 * On release: commit a quarter turn only past roughly a third of the way,
 * or with a clear flick. `velocity` is radians per second in the turning direction.
 */
export function releaseQuarter(angle, velocity = 0) {
  const quarter = Math.PI / 2;
  if (Math.abs(angle) >= quarter * 0.38) return Math.sign(angle);
  if (Math.abs(angle) >= quarter * 0.12 && Math.abs(velocity) > 4.5 && Math.sign(velocity) === Math.sign(angle)) return Math.sign(angle);
  return 0;
}

/* ---------- Ranking helpers shared by client and tests ---------- */

/** Best first: lower time, then fewer moves, then earlier. */
export function compareResults(a, b) {
  return a.timeMs - b.timeMs || a.moves - b.moves || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}
