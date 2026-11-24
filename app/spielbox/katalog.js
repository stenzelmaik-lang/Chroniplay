/* ChroniPlay Spielbox: which games exist and which are already playable.
 * Plain data so the page and the tests read the same list. */
export const SPIELE = Object.freeze([
  Object.freeze({id: 'rubik', name: 'Rubikwürfel', text: 'Mischen, drehen, lösen – gegen die eigene Bestzeit.', stand: 'spielbar'}),
  Object.freeze({id: 'vier-gewinnt', name: 'Vier gewinnt', text: 'Vier in einer Reihe – zu zweit oder gegen den Computer.', stand: 'als Nächstes'}),
  Object.freeze({id: 'mau-mau', name: 'Mau-Mau', text: 'Der Kartenspiel-Klassiker gegen Computer-Gegner.', stand: 'geplant'}),
  Object.freeze({id: 'schiffe-versenken', name: 'Schiffe versenken', text: 'Flotte verstecken und die gegnerische finden.', stand: 'geplant'}),
]);

export function spielbar(id) {
  return SPIELE.some(spiel => spiel.id === id && spiel.stand === 'spielbar');
}
