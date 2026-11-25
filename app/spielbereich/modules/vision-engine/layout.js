/**
 * Platzierung eines Bildmoments auf der Bühne. Das Bild bleibt ein statisches Standbild:
 * Es wird nur einmal platziert und nie bewegt oder gezoomt. Der Brennpunkt (wichtigster Bildbereich)
 * landet an der gewählten Stelle, und der geschützte Kernbereich bleibt auf jedem Format vollständig sichtbar.
 * Reines Modul ohne DOM.
 */
const SIZE_H = {nah: 0.9, mittel: 0.78, weit: 0.66};
const SIZE_INNER = {nah: 0.5, mittel: 0.43, weit: 0.37};
/** Anteil des Wegs vom Brennpunkt zur Bildkante, der vollständig klar bleibt; danach läuft das Bild wolkig aus. */
const SIZE_INNERF = {nah: 0.58, mittel: 0.5, weit: 0.44};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function isPortrait(view) { return view.w / Math.max(1, view.h) < 0.85; }

export function layoutMoment(view, img, m) {
  const W = Math.max(1, view.w), H = Math.max(1, view.h);
  const ar = img && img.width && img.height ? img.width / img.height : 4 / 3;
  const ratio = W / H;
  const portrait = ratio < 0.85;
  const size = SIZE_H[m.size] ? m.size : 'mittel';
  const core = clamp(Number(m.core) || 0.36, 0.15, 0.6);
  const focus = {x: clamp(m.focus?.x ?? 0.5, 0, 1), y: clamp(m.focus?.y ?? 0.5, 0, 1)};
  let h, fx, fy, textPlace, aspectX, areaTop, areaBottom;
  if (portrait) {
    // Handy hochkant: Bild oben, Worte darunter. Mindestens bildschirmbreit, damit das Motiv groß genug bleibt.
    h = Math.max(H * 0.5 * SIZE_H[size] / 0.78, (W / ar) * 1.08);
    fx = W * 0.5; fy = H * 0.35; textPlace = 'bottom'; aspectX = 1.0;
    areaTop = H * 0.03; areaBottom = H * 0.6;
  } else {
    const place = m.place === 'links' || m.place === 'rechts' ? m.place : 'mitte';
    h = H * SIZE_H[size] * (place === 'mitte' ? 0.94 : 1);
    fx = W * (place === 'links' ? 0.35 : place === 'rechts' ? 0.65 : 0.5);
    fy = H * (place === 'mitte' ? 0.42 : 0.5);
    textPlace = place === 'links' ? 'right' : place === 'rechts' ? 'left' : 'bottom';
    aspectX = ratio > 1.3 ? 1.32 : 1.15;
    areaTop = H * 0.03; areaBottom = H * 0.97;
  }
  // Kernbereich vollständig im Bild halten; notfalls das Bild kleiner setzen, nie beschneiden
  let coreR = core * h;
  const avail = areaBottom - areaTop;
  if (2 * coreR > avail) { h *= avail / (2 * coreR); coreR = core * h; }
  if (2 * coreR > W * 0.96) { h *= (W * 0.96) / (2 * coreR); coreR = core * h; }
  fy = clamp(fy, areaTop + coreR, areaBottom - coreR);
  fx = clamp(fx, coreR + W * 0.02, W - coreR - W * 0.02);
  const w = h * ar;
  const inner = Math.max(core * 1.1, SIZE_INNER[size]) * h;
  const outer = inner + 0.34 * h;
  return {rect: {x: fx - focus.x * w, y: fy - focus.y * h, w, h}, focus: {x: fx, y: fy}, inner, outer, innerF: SIZE_INNERF[size], aspectX, textPlace, coreR, portrait};
}

/** Wo stehen Worte ohne Bild (Eintauchen, Schlusssatz)? */
export function freeTextPlace(view) { return isPortrait(view) ? 'center-portrait' : 'center'; }
