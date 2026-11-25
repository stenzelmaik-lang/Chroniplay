/**
 * Zeitliche Regie einer Vision. Alles ist eine reine Funktion der Zeit:
 * Bild, Text, Licht und Ton lesen denselben Zeitplan. Dadurch bleiben sie synchron,
 * und Vorspulen, Pausieren oder Springen im Ersteller verhalten sich exakt gleich wie die Wiedergabe.
 * Reines Modul ohne DOM.
 */
import {typeById, tempoById, intensityById} from './presets.js';

/** Höchstens ein Lichtimpuls je 2,5 Sekunden. WCAG 2.3.1 erlaubt bis zu drei Blitze pro Sekunde; wir bleiben weit darunter. */
export const FLASH_MIN_GAP_MS = 2500;
export const FLASH_RISE_MS = 140;
export const FLASH_DECAY_MS = 720;
/** Obergrenze der Helligkeitsspitze je Intensität (Anteil zusätzlicher Belichtung). Reduzierte Effekte: keine Impulse. */
const FLASH_CAP = {soft: 0.3, normal: 0.55, strong: 0.72};

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ease = {
  inOut: x => x * x * (3 - 2 * x),
  out: x => 1 - (1 - x) * (1 - x),
  in: x => x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
};

/** Lesedauer eines Textes, wie im bestehenden Player: Grundzeit plus Zeit je Zeichen, mit Tempo und Ruhemodus. */
export function readingMs(text, type, tempoFactor = 1, reduced = false) {
  const clean = (text || '').trim();
  if (!clean) return 0;
  const ms = (type.timing.baseMs + clean.length * type.timing.perCharMs) * tempoFactor;
  return Math.round(Math.max(2600, Math.min(16000, reduced ? ms * 1.15 : ms)));
}

const norm = w => w.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, '');
/** Wortpositionen eines Nachhall-Ausdrucks im Text (letztes Vorkommen), sonst leer. */
export function echoIndices(text, phrase) {
  const tokens = (text || '').split(/\s+/).filter(Boolean);
  const target = (phrase || '').split(/\s+/).map(norm).filter(Boolean);
  if (!target.length || target.length > tokens.length) return [];
  for (let i = tokens.length - target.length; i >= 0; i--) {
    if (target.every((w, k) => norm(tokens[i + k]) === w)) return target.map((_, k) => i + k);
  }
  return [];
}

export function flashEnvelope(dt) {
  if (dt < -FLASH_RISE_MS) return 0;
  if (dt < 0) return ease.inOut(1 + dt / FLASH_RISE_MS);
  return Math.exp(-dt / (FLASH_DECAY_MS / 2.7));
}

/**
 * Baut den Ablauf: 01 Eintauchen, je Moment Erinnerungsblitz → Halten → Auflösen → Nachhall, am Ende der Schlusssatz.
 * Bilder und Texte werden nie verworfen oder verdoppelt.
 */
export function buildTimeline(vision, opts = {}) {
  const type = typeById(opts.type ?? vision.type);
  const tempo = tempoById(opts.tempo ?? vision.tempo);
  const intensity = intensityById(opts.intensity ?? vision.intensity);
  const reduced = !!opts.reduced;
  const f = tempo.factor;
  const T = type.timing;
  const emerge = reduced ? 1000 : T.emergeMs;
  const dissolve = reduced ? 1000 : T.dissolveMs;
  const overlap = reduced ? 0 : T.overlapMs;
  const imageHold = Math.max(2600, Math.round(3200 * f));
  const textEnter = reduced ? 700 : type.text.enterMs;
  const moments = (vision.moments || []).filter(m => m && m.image);
  const n = moments.length;
  const texts = [], cues = [], stops = [], tm = [];
  const fogIn = reduced ? 900 : T.enterMs;
  const flashCap = reduced ? 0 : (FLASH_CAP[intensity.id] ?? FLASH_CAP.normal);

  // 01 · Eintauchen: Dunkelheit, aufziehender Nebel, die ersten Worte
  let cursor = fogIn * 0.6;
  const intro = (vision.intro?.text || '').trim();
  cues.push({t: 0, type: 'bed'});
  if (intro) {
    const r = readingMs(intro, type, f, reduced);
    const outAt = cursor + textEnter + r;
    texts.push({key: 'intro', role: 'intro', text: intro, inAt: cursor, outAt, place: 'center', echo: '', echoOut: 0});
    stops.push(outAt);
    cursor = outAt + 900;
  }
  cursor = Math.max(cursor, fogIn);

  let lastFlash = -Infinity;
  moments.forEach((m, i) => {
    const last = i === n - 1;
    const emergeStart = Math.max(0, cursor - (i > 0 ? overlap : 0));
    const holdStart = emergeStart + emerge;
    const text = (m.text || '').trim();
    const echo = (m.echo || '').trim();
    const textIn = emergeStart + emerge * 0.55;
    const read = readingMs(text, type, f, reduced);
    const textNeeds = text ? textIn + textEnter + read - holdStart : 0;
    const hold = Math.round(Math.max(imageHold, textNeeds, Number(m.holdMs) || 0));
    const dissolveMs = last ? Math.round(dissolve * 1.35) : dissolve;
    const dissolveStart = holdStart + hold;
    const dissolveEnd = dissolveStart + dissolveMs;
    const textOut = dissolveStart + dissolveMs * 0.12;
    const echoOut = echo ? dissolveEnd + Math.max(1700, readingMs(echo, type, f, reduced) * 0.55) : 0;
    const contained = !!(text && echo && echoIndices(text, echo).length);
    if (text) texts.push({key: `m${i}`, role: 'fragment', text, inAt: textIn, outAt: textOut, echo: contained ? echo : '', echoOut: contained ? echoOut : 0, moment: i, place: m.place});
    if (echo && !contained) texts.push({key: `e${i}`, role: 'echo', text: echo, inAt: dissolveStart + dissolveMs * 0.35, outAt: echoOut, echo: '', echoOut: 0, moment: i, place: m.place});

    // Erinnerungsblitz: begrenzt, nie schneller als FLASH_MIN_GAP_MS
    let flashAt = null;
    if (type.flashes && flashCap > 0) {
      const at = emergeStart + emerge * (type.id === 'threat' ? 0.4 : 0.6);
      if (at - lastFlash >= FLASH_MIN_GAP_MS) { flashAt = at; lastFlash = at; }
    }
    const escalation = type.escalate ? (n > 1 ? i / (n - 1) : 1) : 0;
    const flashAmp = flashCap * (type.escalate ? 0.7 + 0.3 * escalation : 1);
    tm.push({index: i, slot: i % 2, emergeStart, holdStart, dissolveStart, dissolveEnd, emerge, dissolveMs, hold, flashAt, flashAmp, escalation, echoOut, last});

    cues.push({t: Math.max(0, emergeStart - 250), type: 'swell', moment: i});
    if (flashAt !== null) cues.push({t: flashAt, type: 'impact', moment: i});
    cues.push({t: dissolveStart, type: 'shimmer', moment: i});
    stops.push(emergeStart, holdStart, dissolveStart);
    cursor = last ? dissolveEnd : dissolveEnd + T.gapMs + (echo ? 500 : 0);
  });

  // 04 · Abschluss: Das letzte Bild löst sich auf, ein letzter Satz bleibt im Raum
  const final = (vision.finale?.text || '').trim();
  let end = cursor;
  const lm = tm[n - 1];
  if (final) {
    const finalIn = lm ? lm.dissolveStart + lm.dissolveMs * 0.72 : cursor;
    texts.push({key: 'final', role: 'final', text: final, inAt: finalIn, outAt: Infinity, place: 'center', echo: '', echoOut: 0});
    cues.push({t: Math.max(0, finalIn - 400), type: 'drone'});
    end = Math.max(lm ? lm.dissolveEnd : 0, finalIn + textEnter + readingMs(final, type, f, reduced));
  } else if (lm) {
    end = lm.dissolveEnd + 600;
  }
  stops.push(end);
  return {
    type, tempo, intensity, reduced, fogIn, textEnter,
    textExit: reduced ? 600 : Math.round(type.text.enterMs * 0.9),
    moments: tm, texts, duration: Math.round(end),
    cues: cues.sort((a, b) => a.t - b.t),
    stops: [...new Set(stops.map(Math.round))].filter(s => s > 0).sort((a, b) => a - b),
  };
}

/** Nächster Haltepunkt für „Weiter“. */
export function nextStop(tl, t) {
  return tl.stops.find(s => s > t + 40) ?? tl.duration;
}

/** Der sichtbare Zustand zu einem Zeitpunkt: Bildebenen, Licht, Ton-Hüllkurven und aktive Texte. */
export function frameAt(tl, t) {
  const out = {
    t, presence: ease.inOut(clamp01(t / tl.fogIn)), master: ease.out(clamp01(t / (tl.fogIn * 0.5))),
    slots: [null, null], flash: 0, lightBoost: 0, heart: 0, muffle: 0.55, burst: null, escalation: 0, current: -1, texts: [],
  };
  let visible = 0;
  for (const m of tl.moments) {
    if (t < m.emergeStart || t > m.dissolveEnd) continue;
    const reveal = ease.inOut(clamp01((t - m.emergeStart) / m.emerge));
    const dissolve = ease.in(clamp01((t - m.dissolveStart) / m.dissolveMs));
    const trans = Math.max(1 - reveal, dissolve);
    const flash = m.flashAt === null ? 0 : flashEnvelope(t - m.flashAt) * m.flashAmp;
    const prev = out.slots[m.slot];
    if (!prev || prev.moment < m.index) out.slots[m.slot] = {moment: m.index, reveal, dissolve, flash, trans};
    out.flash = Math.max(out.flash, flash);
    visible = Math.max(visible, reveal * (1 - dissolve));
    if (dissolve > 0 && dissolve < 1) out.burst = {slot: m.slot, moment: m.index, progress: dissolve};
    if (reveal > 0.02 && dissolve < 0.98) { out.current = Math.max(out.current, m.index); out.escalation = Math.max(out.escalation, m.escalation); }
    if (tl.type.id === 'drama') out.lightBoost = Math.max(out.lightBoost, Math.sin(Math.PI * clamp01((t - m.emergeStart) / (m.emerge * 1.25))) * (0.6 + 0.4 * m.escalation));
  }
  out.lightBoost = Math.max(out.lightBoost, out.flash);
  out.heart = visible;
  out.muffle = t < tl.fogIn ? 0.8 : 1 - visible;
  for (const x of tl.texts) {
    const end = Math.max(x.outAt, x.echoOut || 0);
    if (t >= x.inAt - 30 && t <= end + tl.textExit + 120) out.texts.push(x);
  }
  return out;
}
