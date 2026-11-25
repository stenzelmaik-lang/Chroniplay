/**
 * Die sechs Visionstypen als Daten. Jeder Typ hat eine eigene Effektsprache:
 * Nebelverhalten, Licht, Bildentstehung, Auflösung, Partikel, Typografie und Klang.
 * Renderer, Typografie und Audio lesen nur diese Werte. Ein neuer Look ist ein neuer Eintrag, keine neue Logik.
 * Reines Modul ohne DOM, damit es auch in Node-Tests läuft.
 */

/** Bildentstehung: 0 radial aus dem Nebel, 1 fließend, 2 aus der Dunkelheit (helle Bildteile zuerst), 3 Erinnerungsblitz, 4 Lichtschweif */
export const REVEAL = {radial: 0, flow: 1, luminance: 2, burst: 3, sweep: 4};
/** Partikelarten */
export const PARTICLES = {motes: 0, bokeh: 1, ash: 2, embers: 3, sparks: 4, dust: 5};

export const VISION_TYPES = [
  {
    id: 'classic', label: 'Klassische Vision', mood: 'Mystisch · silbern · ausgewogen',
    language: 'Silbernes Licht fällt von oben in ruhigen Nebel. Das Bild öffnet sich weich aus der Mitte und zerfällt in feinen Silberstaub.',
    swatch: 'radial-gradient(circle at 40% 35%, #f2ead5, #8d8a84 45%, #1a1c22 80%)',
    timing: {enterMs: 2600, baseMs: 2600, perCharMs: 48, emergeMs: 2000, dissolveMs: 2300, overlapMs: 0, gapMs: 900},
    palette: {bgTop: [0.045, 0.05, 0.066], bgBottom: [0.008, 0.009, 0.013], fogA: [0.62, 0.64, 0.70], fogB: [0.17, 0.18, 0.22], front: [0.46, 0.48, 0.54], light: [1.0, 0.93, 0.78], glow: [0.86, 0.9, 1.0]},
    fog: {density: 0.62, front: 0.30, scale: 1.4, warp: 1.1, flow: [0.010, 0.003], low: 0.2, dark: 0, tendrils: 0},
    light: {pos: [0.5, 1.14], dir: [0, -1], spread: 0.42, rays: 0.55, intensity: 0.9, pulse: 0.12, pulseHz: 0.06},
    dissolve: {band: 0.16, glow: 0.7, flow: 0},
    image: {reveal: REVEAL.radial, edgeNoise: 0.22, holes: 0, breathe: 1.0, refract: 0, chroma: 0, ghost: 0, glow: 0.55, filter: 0.40, sat: 0.80, contrast: 1.03, lift: 0.0, tintShadow: [0.93, 0.96, 1.05], tintHigh: [1.05, 1.01, 0.95]},
    post: {grain: 0.022, vignette: 0.62, flicker: 0},
    particles: {kind: PARTICLES.motes, count: 380, color: [0.86, 0.89, 0.97], size: [1.0, 3.0], speed: 0.010, alpha: 0.55, additive: true, beam: 0.4},
    text: {color: '#eef0f5', glow: 'rgba(200,210,235,.32)', enterMs: 1100, stagger: 85, blur: 9, y: 10, x: 0, ghost: 0, jitter: 0, wave: 0, scale: 1, incomplete: 0},
    audio: {swell: 0.55, impact: 0, shimmer: 0.45, crackle: 0, muffle: 0.5, heart: 0.35, drone: 0.45},
    flashes: false, escalate: false, sweepDir: [1, 0],
  },
  {
    id: 'dream', label: 'Traumvision', mood: 'Fließend · bläulich · entrückt',
    language: 'Blaue Schleier strömen seitlich durch das Bild. Erinnerungen fließen mit weicher Lichtbrechung ineinander, Lichtpunkte schweben unscharf vorbei.',
    swatch: 'radial-gradient(circle at 40% 35%, #bff3ff, #2b8aa8 45%, #04131f 80%)',
    timing: {enterMs: 3000, baseMs: 3000, perCharMs: 52, emergeMs: 2400, dissolveMs: 2600, overlapMs: 900, gapMs: 350},
    palette: {bgTop: [0.02, 0.06, 0.09], bgBottom: [0.004, 0.014, 0.024], fogA: [0.45, 0.80, 0.92], fogB: [0.08, 0.24, 0.34], front: [0.36, 0.62, 0.74], light: [0.72, 0.95, 1.0], glow: [0.6, 0.95, 1.0]},
    fog: {density: 0.58, front: 0.27, scale: 1.1, warp: 1.8, flow: [0.022, 0.0], low: 0, dark: 0, tendrils: 0},
    light: {pos: [0.16, 1.06], dir: [0.35, -1], spread: 0.5, rays: 0.35, intensity: 0.8, pulse: 0.10, pulseHz: 0.05},
    dissolve: {band: 0.22, glow: 0.6, flow: 0.6},
    image: {reveal: REVEAL.flow, edgeNoise: 0.30, holes: 0, breathe: 1.6, refract: 1.0, chroma: 0.6, ghost: 0.35, glow: 0.6, filter: 0.42, sat: 0.85, contrast: 0.98, lift: 0.015, tintShadow: [0.86, 1.0, 1.12], tintHigh: [1.0, 1.04, 1.06]},
    post: {grain: 0.015, vignette: 0.5, flicker: 0},
    particles: {kind: PARTICLES.bokeh, count: 90, color: [0.65, 0.92, 1.0], size: [6, 26], speed: 0.006, alpha: 0.22, additive: true, beam: 0},
    text: {color: '#e8f7fb', glow: 'rgba(120,220,240,.32)', enterMs: 1500, stagger: 110, blur: 12, y: 0, x: 14, ghost: 0, jitter: 0, wave: 1, scale: 1, incomplete: 0},
    audio: {swell: 0.5, impact: 0, shimmer: 0.6, crackle: 0, muffle: 0.7, heart: 0.2, drone: 0.5},
    flashes: false, escalate: false, sweepDir: [1, 0],
  },
  {
    id: 'dark', label: 'Dunkle Vision', mood: 'Verschluckt · schwarz · bedrückend',
    language: 'Schwarzer Rauch frisst das Licht. Motive treten langsam aus der Finsternis, ihre hellsten Stellen zuerst, und werden am Ende wieder vom Schatten verschlungen.',
    swatch: 'radial-gradient(circle at 50% 30%, #6d6f76, #1b1c1f 50%, #000 85%)',
    timing: {enterMs: 2800, baseMs: 2800, perCharMs: 50, emergeMs: 3000, dissolveMs: 3000, overlapMs: 0, gapMs: 1200},
    palette: {bgTop: [0.026, 0.026, 0.03], bgBottom: [0.0, 0.0, 0.0], fogA: [0.24, 0.24, 0.27], fogB: [0.02, 0.02, 0.025], front: [0.012, 0.012, 0.014], light: [0.78, 0.76, 0.72], glow: [0.0, 0.0, 0.0]},
    fog: {density: 0.75, front: 0.5, scale: 1.2, warp: 1.2, flow: [0.006, 0.004], low: 0.3, dark: 0.85, tendrils: 0.45},
    light: {pos: [0.5, 0.62], dir: [0, -1], spread: 0.0, rays: 0.0, intensity: 0.25, pulse: 0.06, pulseHz: 0.04},
    dissolve: {band: 0.18, glow: 1.0, flow: 0},
    image: {reveal: REVEAL.luminance, edgeNoise: 0.28, holes: 0, breathe: 0.8, refract: 0, chroma: 0, ghost: 0, glow: -0.8, filter: 0.45, sat: 0.55, contrast: 1.08, lift: -0.02, tintShadow: [0.93, 0.95, 1.0], tintHigh: [1.0, 1.0, 0.98]},
    post: {grain: 0.03, vignette: 0.85, flicker: 0},
    particles: {kind: PARTICLES.ash, count: 140, color: [0.05, 0.05, 0.055], size: [1.5, 4.0], speed: 0.012, alpha: 0.7, additive: false, beam: 0},
    text: {color: '#dcdcdf', glow: 'rgba(0,0,0,.65)', enterMs: 1800, stagger: 140, blur: 6, y: 0, x: 0, ghost: 0, jitter: 0, wave: 0, scale: 1, incomplete: 0},
    audio: {swell: 0.45, impact: 0, shimmer: 0.2, crackle: 0, muffle: 0.85, heart: 0.5, drone: 0.6},
    flashes: false, escalate: false, sweepDir: [1, 0],
  },
  {
    id: 'threat', label: 'Bedrohliche Vision', mood: 'Gefahr · dunkelrot · unruhig',
    language: 'Dunkelrotes Licht pulsiert langsam von unten, Schatten kriechen vom Rand. Bilder schlagen als kurze Erinnerungsblitze ein, gedämpft und ohne Stroboskop.',
    swatch: 'radial-gradient(circle at 25% 85%, #b0141f, #200307 45%, #000 80%)',
    timing: {enterMs: 2400, baseMs: 2400, perCharMs: 46, emergeMs: 1100, dissolveMs: 1800, overlapMs: 0, gapMs: 700},
    palette: {bgTop: [0.04, 0.006, 0.01], bgBottom: [0.0, 0.0, 0.0], fogA: [0.48, 0.07, 0.08], fogB: [0.05, 0.01, 0.012], front: [0.09, 0.01, 0.014], light: [1.0, 0.18, 0.13], glow: [1.0, 0.2, 0.1]},
    fog: {density: 0.7, front: 0.42, scale: 1.3, warp: 1.4, flow: [0.014, 0.006], low: 1.0, dark: 0.35, tendrils: 0.75},
    light: {pos: [0.5, -0.16], dir: [0, 1], spread: 0.55, rays: 0.4, intensity: 1.0, pulse: 0.35, pulseHz: 0.22},
    dissolve: {band: 0.1, glow: 1.0, flow: 0},
    image: {reveal: REVEAL.burst, edgeNoise: 0.34, holes: 0, breathe: 2.2, refract: 0.25, chroma: 0.9, ghost: 0.5, glow: 0.7, filter: 0.42, sat: 0.70, contrast: 1.12, lift: -0.01, tintShadow: [1.12, 0.9, 0.9], tintHigh: [1.05, 0.97, 0.95]},
    post: {grain: 0.03, vignette: 0.8, flicker: 0},
    particles: {kind: PARTICLES.embers, count: 220, color: [1.0, 0.36, 0.18], size: [1.0, 3.5], speed: 0.02, alpha: 0.7, additive: true, beam: 0},
    text: {color: '#f3e6e4', glow: 'rgba(170,20,20,.45)', enterMs: 900, stagger: 60, blur: 5, y: 6, x: 0, ghost: 0, jitter: 1, wave: 0, scale: 1, incomplete: 0},
    audio: {swell: 0.5, impact: 0.8, shimmer: 0.2, crackle: 0, muffle: 0.6, heart: 0.8, drone: 0.7},
    flashes: true, escalate: false, sweepDir: [1, 0],
  },
  {
    id: 'drama', label: 'Dramatische Vision', mood: 'Schicksal · Kontrast · Steigerung',
    language: 'Goldene Lichtschweife enthüllen jedes Bild. Kontrast, Licht und Funken steigern sich von Moment zu Moment bis zur Offenbarung.',
    swatch: 'conic-gradient(from 200deg, #3b0c44, #f0b14a 12%, #3b0c44 25%, #c4362a 40%, #3b0c44 55%, #f0b14a 70%, #3b0c44)',
    timing: {enterMs: 2400, baseMs: 2400, perCharMs: 45, emergeMs: 1800, dissolveMs: 2200, overlapMs: 0, gapMs: 800},
    palette: {bgTop: [0.06, 0.02, 0.07], bgBottom: [0.01, 0.004, 0.014], fogA: [0.55, 0.32, 0.55], fogB: [0.12, 0.04, 0.14], front: [0.36, 0.21, 0.36], light: [1.0, 0.78, 0.40], glow: [1.0, 0.75, 0.35]},
    fog: {density: 0.6, front: 0.3, scale: 1.2, warp: 1.3, flow: [-0.012, 0.004], low: 0.1, dark: 0, tendrils: 0},
    light: {pos: [1.08, 1.06], dir: [-0.7, -1], spread: 0.35, rays: 0.85, intensity: 1.1, pulse: 0.22, pulseHz: 0.09},
    dissolve: {band: 0.12, glow: 1.1, flow: -0.3},
    image: {reveal: REVEAL.sweep, edgeNoise: 0.24, holes: 0, breathe: 1.0, refract: 0, chroma: 0.3, ghost: 0, glow: 0.9, filter: 0.40, sat: 0.95, contrast: 1.16, lift: -0.015, tintShadow: [1.05, 0.92, 1.12], tintHigh: [1.08, 1.0, 0.88]},
    post: {grain: 0.02, vignette: 0.75, flicker: 0},
    particles: {kind: PARTICLES.sparks, count: 260, color: [1.0, 0.78, 0.42], size: [1.0, 3.0], speed: 0.03, alpha: 0.6, additive: true, beam: 0.3},
    text: {color: '#f6ecd8', glow: 'rgba(240,170,70,.38)', enterMs: 1000, stagger: 70, blur: 8, y: 0, x: 0, ghost: 0, jitter: 0, wave: 0, scale: 1.08, incomplete: 0},
    audio: {swell: 0.7, impact: 0.5, shimmer: 0.5, crackle: 0, muffle: 0.4, heart: 0.5, drone: 0.7},
    flashes: true, escalate: true, sweepDir: [0.8, -0.6],
  },
  {
    id: 'echo', label: 'Erinnerungsecho', mood: 'Verblasst · golden · unvollständig',
    language: 'Verblasste Standbilder mit Filmkorn und goldenem Staub im Lichtstrahl. Ränder brechen wie altes Papier, Doppelkonturen flackern beim Erscheinen auf, Worte bleiben als Nachhall zurück.',
    swatch: 'radial-gradient(circle at 45% 45%, #efe3cc, #8a7a5e 50%, #2a241c 85%)',
    timing: {enterMs: 3000, baseMs: 3000, perCharMs: 52, emergeMs: 2200, dissolveMs: 2600, overlapMs: 0, gapMs: 1100},
    palette: {bgTop: [0.05, 0.042, 0.032], bgBottom: [0.01, 0.008, 0.006], fogA: [0.68, 0.60, 0.47], fogB: [0.16, 0.13, 0.10], front: [0.48, 0.42, 0.34], light: [1.0, 0.84, 0.55], glow: [1.0, 0.78, 0.42]},
    fog: {density: 0.64, front: 0.3, scale: 1.3, warp: 1.0, flow: [0.008, 0.002], low: 0.15, dark: 0, tendrils: 0},
    light: {pos: [0.8, 1.1], dir: [-0.4, -1], spread: 0.30, rays: 0.7, intensity: 0.95, pulse: 0.08, pulseHz: 0.05},
    dissolve: {band: 0.26, glow: 0.45, flow: 0},
    image: {reveal: REVEAL.radial, edgeNoise: 0.30, holes: 0.35, breathe: 0.9, refract: 0.15, chroma: 0.15, ghost: 0.6, glow: 0.75, filter: 0.50, sat: 0.45, contrast: 1.05, lift: 0.01, tintShadow: [0.95, 0.98, 1.04], tintHigh: [1.10, 1.0, 0.82]},
    post: {grain: 0.04, vignette: 0.7, flicker: 0.6},
    particles: {kind: PARTICLES.dust, count: 420, color: [1.0, 0.82, 0.5], size: [0.8, 2.6], speed: 0.004, alpha: 0.55, additive: true, beam: 1.0},
    text: {color: '#f2e8d5', glow: 'rgba(220,170,90,.28)', enterMs: 1300, stagger: 95, blur: 10, y: 4, x: 0, ghost: 1, jitter: 0, wave: 0, scale: 1, incomplete: 1},
    audio: {swell: 0.5, impact: 0, shimmer: 0.4, crackle: 0.6, muffle: 0.6, heart: 0.55, drone: 0.5},
    flashes: false, escalate: false, sweepDir: [1, 0],
  },
];

export const TEMPOS = [
  {id: 'calm', label: 'Ruhig', factor: 1.3},
  {id: 'normal', label: 'Normal', factor: 1},
  {id: 'brisk', label: 'Zügig', factor: 0.72},
];

/** Intensität skaliert Nebel, Licht, Partikel, Doppelkonturen und Lichtimpulse. Bildtreue und Lesbarkeit bleiben unberührt. */
export const INTENSITIES = [
  {id: 'soft', label: 'Sanft', factor: 0.6},
  {id: 'normal', label: 'Normal', factor: 1},
  {id: 'strong', label: 'Intensiv', factor: 1.3},
];

export const SIZES = [
  {id: 'nah', label: 'Nah'},
  {id: 'mittel', label: 'Mittel'},
  {id: 'weit', label: 'Weit'},
];
export const PLACES = [
  {id: 'links', label: 'Links'},
  {id: 'mitte', label: 'Mitte'},
  {id: 'rechts', label: 'Rechts'},
];

export const typeById = id => VISION_TYPES.find(t => t.id === id) ?? VISION_TYPES[0];
export const tempoById = id => TEMPOS.find(t => t.id === id) ?? TEMPOS[1];
export const intensityById = id => INTENSITIES.find(t => t.id === id) ?? INTENSITIES[1];
