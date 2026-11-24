/* ChroniPlay Spielbox: results without login stay in this browser only.
 * Pure helpers with an injectable storage, so the page and the tests share one definition.
 * Nothing here talks to a server. */
import {compareResults} from '../spielbereich/modules/spieltisch/spielpause/cube-moves.js';

/** How many results per game are kept. The leaderboard shows the best ten. */
export const MAX_RESULTS = 10;
const PREFIX = 'chroniplay:spielbox:ergebnisse:';
const GAME = /^[a-z0-9-]{1,32}$/;

/** @typedef {{timeMs:number, moves:number, createdAt?:string}} Result */

export function storageKey(game) {
  if (!GAME.test(String(game))) throw new Error('Unbekanntes Spiel: ' + game);
  return PREFIX + game;
}

/** Only plausible entries survive: whole milliseconds and moves, at most a day, a readable date.
 * @returns {Result|null} */
export function cleanResult(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const {timeMs, moves, createdAt} = entry;
  if (!Number.isSafeInteger(timeMs) || timeMs < 0 || timeMs > 86_400_000) return null;
  if (!Number.isSafeInteger(moves) || moves < 0 || moves > 100_000) return null;
  const date = typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : undefined;
  return date ? {timeMs, moves, createdAt: date} : {timeMs, moves};
}

/** Best first, at most MAX_RESULTS, broken entries dropped.
 * @returns {Result[]} */
export function rankResults(entries) {
  return (Array.isArray(entries) ? entries : []).map(cleanResult).filter(/** @returns {entry is Result} */ entry => entry !== null).sort(compareResults).slice(0, MAX_RESULTS);
}

function safeStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Reads the saved list. Missing, blocked or broken storage simply gives an empty list. */
export function readResults(game, storage) {
  const store = safeStorage(storage);
  if (!store) return [];
  try { return rankResults(JSON.parse(store.getItem(storageKey(game)) || '[]')); }
  catch { return []; }
}

/** Adds one result and returns the new ranked list. Throws only if the browser refuses to store. */
export function addResult(game, result, storage, now = new Date()) {
  const store = safeStorage(storage);
  const entry = cleanResult({...result, createdAt: now.toISOString()});
  if (!entry) throw new Error('Ungültiges Ergebnis.');
  const list = rankResults([...readResults(game, store), entry]);
  if (!store) throw new Error('Dieser Browser speichert nichts.');
  store.setItem(storageKey(game), JSON.stringify(list));
  return list;
}

/** Deletes the saved results of one game. */
export function clearResults(game, storage) {
  const store = safeStorage(storage);
  try { store?.removeItem(storageKey(game)); } catch { /* nothing to delete */ }
}

/** The services object the Spielpause runtime expects: {loadResults, saveResult}. */
export function localResultService(game, storage) {
  return {
    async loadResults() { return readResults(game, storage); },
    async saveResult(result) { return addResult(game, {timeMs: result.timeMs, moves: result.moves}, storage); },
  };
}
