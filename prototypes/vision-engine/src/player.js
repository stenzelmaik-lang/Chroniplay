/**
 * Der Vision-Player: verbindet Zeitplan, Renderer, Typografie und Ton zu einer Inszenierung.
 * mode 'play': Spieleransicht (Vollbild, Bedienelemente blenden sich bei Ruhe aus).
 * mode 'embedded': Bühne im Ersteller (gesteuert über die Transportleiste, Nebel lebt auch in der Pause).
 */
import {buildTimeline, frameAt, nextStop, clamp01} from './timeline.js';
import {typeById} from './presets.js';
import {layoutMoment, isPortrait} from './layout.js';
import {VisionRenderer, shaderParams} from './engine.js';
import {FallbackRenderer} from './fallback.js';
import {TextLayer} from './typography.js';
import {VisionAudio} from './audio.js';
import {PerfMonitor} from './perf.js';

const EFFECTS_KEY = 'chroniplay-vision-effects';
const bitmaps = new Map();
/** Dekodiert ein Standbild einmal (außerhalb des Bildaufbaus) und hält es für erneute Texturen bereit. */
export function loadBitmap(url) {
  if (!bitmaps.has(url)) {
    bitmaps.set(url, (async () => {
      const t0 = performance.now();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Bild nicht gefunden: ${url}`);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      return {bitmap, width: bitmap.width, height: bitmap.height, bytes: blob.size, decodeMs: Math.round(performance.now() - t0)};
    })());
    bitmaps.get(url).catch(() => bitmaps.delete(url));
  }
  return bitmaps.get(url);
}

const TOOLS = `
  <button type="button" class="v-btn v-next" data-act="next" aria-keyshortcuts="Space ArrowRight">Weiter ›</button>
  <button type="button" class="v-btn" data-act="fulltext" aria-pressed="false">Text vollständig anzeigen</button>
  <button type="button" class="v-btn" data-act="effects" aria-pressed="false">Effekte ruhiger</button>
  <button type="button" class="v-btn" data-act="sound">Ton aus</button>
  <button type="button" class="v-btn" data-act="skip">Vision überspringen</button>`;

export class VisionPlayer {
  constructor(stage, {mode = 'play', onState = () => {}, onEnd = () => {}} = {}) {
    this.stage = stage; this.mode = mode; this.onState = onState; this.onEnd = onEnd;
    this.vision = null; this.moments = []; this.tl = null; this.t = 0; this.playing = false; this.rate = 1; this.ff = null;
    this.ended = false; this.exitAt = 0; this.ambient = 0; this.last = 0; this.layouts = []; this.dims = new Map();
    this.displayScale = 1; this.osReduced = false; this.ownReduced = false; this.autoQuality = true; this.hudOn = false;
    this.audioStarted = false; this.muted = false; this.loadStats = []; this.lastState = 0; this.lastHud = 0; this.bench = null;
    this._dom();
    this.text = new TextLayer(this.words, this.live);
    this.audio = new VisionAudio();
    this.perf = new PerfMonitor();
    try {
      this.renderer = new VisionRenderer(this.canvas, {onLost: lost => this._notice(lost ? 'Grafikkontext verloren. Er wird wiederhergestellt …' : '')});
      this.engine = 'webgl2';
    } catch (e) {
      this.renderer = new FallbackRenderer(this.canvas);
      this.engine = 'canvas2d';
      this.engineError = String(e?.message || e);
      this._notice('WebGL2 ist nicht verfügbar. Die einfache Darstellung ist aktiv.');
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.osReduced = mq.matches;
    mq.addEventListener('change', () => { this.osReduced = mq.matches; this._reducedChanged(); });
    try { this.ownReduced = localStorage.getItem(EFFECTS_KEY) === 'reduced'; } catch { /* nur Komfort */ }
    this.ro = new ResizeObserver(() => this._layout());
    this.ro.observe(stage);
    this.placeOf = x => {
      if (x.role === 'intro' || x.role === 'final') return isPortrait(this.view) ? 'center-portrait' : 'center';
      return this.layouts[x.moment]?.textPlace || 'bottom';
    };
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  get reduced() { return this.osReduced || this.ownReduced; }

  _dom() {
    const s = this.stage;
    s.classList.add('v-stage');
    s.dataset.mode = this.mode;
    s.innerHTML = `
      <canvas class="v-canvas" aria-hidden="true"></canvas>
      <div class="v-words"></div>
      <div class="v-live sr-only" aria-live="polite"></div>
      <div class="v-fulltext" hidden><div class="v-fulltext-body" tabindex="0" role="region" aria-label="Vollständiger Visionstext"></div><button type="button" class="v-btn" data-act="fulltext">Zur laufenden Vision</button></div>
      <div class="v-end" hidden><button type="button" class="v-btn v-btn--primary" data-act="ack">Ich habe alles gesehen</button><button type="button" class="v-btn" data-act="replay">Noch einmal</button></div>
      <div class="v-tools" role="toolbar" aria-label="Vision steuern">${TOOLS}<button type="button" class="v-btn" data-act="unmute" hidden>Ton einschalten</button></div>
      <pre class="v-hud" hidden></pre>
      <p class="v-notice" hidden></p>`;
    this.canvas = s.querySelector('.v-canvas');
    this.words = s.querySelector('.v-words');
    this.live = s.querySelector('.v-live');
    this.fullEl = s.querySelector('.v-fulltext');
    this.fullBody = s.querySelector('.v-fulltext-body');
    this.endEl = s.querySelector('.v-end');
    this.toolsEl = s.querySelector('.v-tools');
    this.hudEl = s.querySelector('.v-hud');
    this.noticeEl = s.querySelector('.v-notice');
    s.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) { this._act(b.dataset.act); return; }
      if (this.mode === 'play' && (e.target === s || e.target === this.canvas || e.target === this.words)) this.next();
    });
    if (this.mode === 'play') {
      s.tabIndex = -1;
      s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', 'Eine Vision');
      s.addEventListener('keydown', e => this._keys(e));
    }
    let idle;
    const wake = () => { s.classList.remove('is-idle'); clearTimeout(idle); idle = setTimeout(() => s.classList.add('is-idle'), 2600); };
    s.addEventListener('pointermove', wake); s.addEventListener('keydown', wake); s.addEventListener('focusin', wake);
    wake();
  }
  _notice(msg) { this.noticeEl.textContent = msg; this.noticeEl.hidden = !msg; }

  _keys(e) {
    if (e.key === 'Escape') { e.preventDefault(); this._act('fulltext'); return; }
    if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && e.target === this.stage) { e.preventDefault(); this.next(); return; }
    if (e.key === 'p' || e.key === 'P') { this.setHud(!this.hudOn); return; }
    if (e.key === 'Tab') {
      const f = [...this.stage.querySelectorAll('button:not([hidden]):not([disabled]), [tabindex="0"]')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  _act(a) {
    if (a === 'next') this.next();
    else if (a === 'skip') this.skip();
    else if (a === 'replay') this.replay();
    else if (a === 'ack') this.acknowledge();
    else if (a === 'effects') this.setOwnReduced(!this.ownReduced);
    else if (a === 'sound') this.setMuted(!this.muted);
    else if (a === 'unmute') void this._startAudio(true);
    else if (a === 'fulltext') {
      const show = this.fullEl.hidden;
      this.fullEl.hidden = !show;
      this.toolsEl.querySelector('[data-act="fulltext"]').setAttribute('aria-pressed', String(show));
      if (show) this.fullBody.focus({preventScroll: true}); else this.stage.focus?.({preventScroll: true});
    }
  }

  /** Lädt Bilder (einmal dekodiert), Ton im Hintergrund und baut den Ablauf. */
  async load(vision) {
    this.vision = vision;
    const missing = await this.ensureImages(vision);
    this.audioReady = this.audio.load({bed: vision.audio?.bed, heart: vision.audio?.heart});
    this.rebuild({reset: true});
    return {missing};
  }
  async ensureImages(vision) {
    const urls = [...new Set((vision.moments || []).map(m => m?.image).filter(Boolean))];
    const missing = [];
    await Promise.all(urls.map(async url => {
      try {
        const r = await loadBitmap(url);
        if (!this.renderer.hasImage(url)) {
          this.renderer.setImage(url, r.bitmap);
          this.loadStats.push({url, bytes: r.bytes, decodeMs: r.decodeMs, w: r.width, h: r.height});
        }
        this.dims.set(url, {width: r.width, height: r.height});
      } catch { missing.push(url); }
    }));
    return missing;
  }
  async setAudio(audio) { this.vision.audio = audio; this.audioReady = this.audio.load({bed: audio?.bed, heart: audio?.heart}); const r = await this.audioReady; if (this.audioStarted && this.playing) this.audio.start(this.tl, this.t); return r; }

  /** Nach jeder Änderung im Ersteller: Ablauf neu berechnen, Zeitposition halten. */
  rebuild({reset = false} = {}) {
    const v = this.vision;
    if (!v) return;
    const first = !this.tl;
    this.moments = (v.moments || []).filter(m => m && m.image);
    const type = typeById(v.type);
    const typeChanged = this.type && this.type.id !== type.id;
    this.type = type;
    this.tl = buildTimeline(v, {reduced: this.reduced});
    this.renderer.setParams(shaderParams(type, {intensity: this.tl.intensity.factor, filter: v.filter ?? null, reduced: this.reduced}), first);
    this.renderer.setDiscrete({reveal: type.image.reveal, particleKind: type.particles.kind, additive: type.particles.additive, sweepDir: type.sweepDir, pulseHz: type.light.pulseHz});
    this.text.clear();
    this.text.setType(type);
    this.text.setReduced(this.reduced);
    this.audio.setType(type);
    if (this.audioStarted) this.audio.tl = this.tl;
    if (reset) { this.t = 0; this.ended = false; }
    this.t = Math.min(this.t, this.tl.duration);
    this.ended = this.t >= this.tl.duration && this.tl.duration > 0;
    if (typeChanged || reset) this.audio.seek(this.t);
    this._layout();
    this._fullText();
  }

  _layout() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.view = {w, h};
    this.renderer.setSize(w, h, (window.devicePixelRatio || 1) * this.displayScale);
    this.layouts = this.moments.map(m => { const d = this.dims.get(m.image); return d ? layoutMoment(this.view, d, m) : null; });
    this.stage.dataset.portrait = isPortrait(this.view) ? '1' : '';
    this.text.relayout(this.placeOf);
  }
  /** Die Vorschau im Ersteller wird verkleinert dargestellt; es werden nur so viele Pixel berechnet wie sichtbar. */
  setDisplayScale(k) { this.displayScale = k; this._layout(); }

  _fullText() {
    const v = this.vision, parts = [v.intro?.text, ...this.moments.flatMap(m => [m.text, m.echo && !(m.text || '').includes(m.echo) ? m.echo : '']), v.finale?.text].map(s => (s || '').trim()).filter(Boolean);
    this.fullBody.replaceChildren(...parts.map(t => { const p = document.createElement('p'); p.textContent = t; return p; }));
    this.toolsEl.querySelector('[data-act="fulltext"]').hidden = !parts.length;
  }

  async _startAudio(fromGesture = false) {
    const ok = await this.audio.unlock();
    this.toolsEl.querySelector('[data-act="unmute"]').hidden = ok || !this.audio.available;
    if (!ok) return false;
    await this.audioReady;
    if (!this.playing && !fromGesture) return false;
    this.audio.setMuted(this.muted);
    this.audio.start(this.tl, this.t);
    this.audioStarted = true;
    return true;
  }
  play() {
    if (!this.tl) return;
    if (this.ended) { this.replay(); return; }
    this.playing = true;
    if (this.audioStarted) { this.audio.resume(); this.audio.seek(this.t); } else void this._startAudio();
    this.last = 0;
  }
  pause() { this.playing = false; this.ff = null; this.rate = 1; this.audio.rate = 1; this.audio.skipUntil = null; this.audio.pause(); }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  seek(t) {
    if (!this.tl) return;
    this.t = Math.max(0, Math.min(this.tl.duration, t));
    this.ff = null; this.rate = 1; this.audio.rate = 1; this.audio.skipUntil = null;
    this.ended = this.t >= this.tl.duration;
    this.exitAt = 0;
    this.audio.seek(this.t);
  }
  /** Springt in die Haltephase eines Moments (Ersteller: Moment auswählen). */
  seekMoment(i) { const m = this.tl?.moments[i]; if (m) this.seek(m.holdStart + Math.min(900, m.hold * 0.4)); }
  /** „Weiter“: spult organisch (sechsfach) bis zum nächsten Haltepunkt, statt hart zu schneiden. */
  next() {
    if (!this.tl || this.ended) return;
    if (!this.playing) this.play();
    const target = nextStop(this.tl, this.t);
    this.ff = target; this.rate = 6;
    this.audio.rate = 6; this.audio.skipUntil = target;
  }
  skip() { this.seek(this.tl.duration); this.ended = true; }
  replay() {
    this.seek(0); this.ended = false; this.exitAt = 0; this.text.clear();
    this.playing = true;
    if (this.audioStarted) { this.audio.resume(); this.audio.start(this.tl, 0); } else void this._startAudio();
    this.stage.focus?.({preventScroll: true});
  }
  acknowledge() { if (this.exitAt) return; this.exitAt = performance.now(); this.audio.stop(1.4); }
  setMuted(m) {
    this.muted = m; this.audio.setMuted(m);
    const b = this.toolsEl.querySelector('[data-act="sound"]'); b.textContent = m ? 'Ton an' : 'Ton aus';
  }
  setVolume(v) { this.audio.setVolume(v); }
  setOwnReduced(v) {
    this.ownReduced = v;
    try { localStorage.setItem(EFFECTS_KEY, v ? 'reduced' : 'full'); } catch { /* nur Komfort */ }
    this._reducedChanged();
  }
  _reducedChanged() {
    const b = this.toolsEl.querySelector('[data-act="effects"]');
    b.textContent = this.ownReduced ? 'Effekte wieder voll' : 'Effekte ruhiger';
    b.setAttribute('aria-pressed', String(this.ownReduced));
    if (!this.tl) return;
    const cur = this.tl.moments.find(m => this.t >= m.emergeStart && this.t <= m.dissolveEnd);
    this.rebuild();
    if (cur) this.seekMoment(cur.index);
  }
  setQuality(q) { if (q === 'auto') this.autoQuality = true; else { this.autoQuality = false; this.renderer.setQuality(q); } }
  setHud(on) { this.hudOn = on; this.hudEl.hidden = !on; }
  startBenchmark() { this.bench = {startedAt: performance.now(), samples: [], qualityChanges: []}; this.perf.reset(); }

  _loop(now) {
    this.raf = requestAnimationFrame(this._loop);
    if (!this.tl || !this.view) return;
    const dt = this.last ? Math.min(100, now - this.last) : 16.7;
    // Ersteller in der Pause: halbe Bildrate genügt, der Nebel lebt trotzdem
    if (this.mode === 'embedded' && !this.playing && this.last && now - this.last < 32) return;
    this.last = now;
    const cpu0 = performance.now();
    this.ambient += (dt / 1000) * (this.reduced ? 0.4 : 1);
    if (this.playing && !this.ended) {
      this.t += dt * this.rate;
      if (this.ff !== null && this.t >= this.ff) { this.t = this.ff; this.ff = null; this.rate = 1; this.audio.rate = 1; this.audio.skipUntil = null; }
      if (this.t >= this.tl.duration) { this.t = this.tl.duration; this.ended = true; }
    }
    const f = frameAt(this.tl, this.t);
    f.slots = f.slots.map(sl => (sl ? {...sl, imageKey: this.moments[sl.moment]?.image, layout: this.layouts[sl.moment]} : null));
    if (this.exitAt) {
      const k = clamp01((now - this.exitAt) / 1400);
      f.master *= 1 - k; f.presence *= 1 - k * 0.6;
      this.words.style.opacity = String(1 - k);
      if (k >= 1 && !this.exited) { this.exited = true; this.onEnd(); }
    } else { this.words.style.opacity = ''; this.exited = false; }
    f.textShade = this.text.update(this.t, f.texts, this.tl.textExit, this.placeOf);
    this.renderer.render(f, this.ambient, dt / 1000);
    if (this.playing) this.audio.tick(this.t, f);
    this.lastFrame = f;
    const cpu = performance.now() - cpu0;
    // Nur echte Wiedergabe zählt: die pausierte Vorschau rendert absichtlich mit halber Bildrate
    if (this.playing && !this.ended) this.perf.frame(dt, cpu);
    if (this.autoQuality && this.renderer.setQuality && this.playing) {
      const q = this.perf.evaluate(this.renderer, now);
      if (q) { this.renderer.setQuality(q); this.bench?.qualityChanges.push({t: Math.round(this.t), to: q}); }
    }
    const showEnd = this.ended && !this.exitAt;
    if (this.endEl.hidden === showEnd) { this.endEl.hidden = !showEnd; if (showEnd && this.mode === 'play') this.endEl.querySelector('button').focus({preventScroll: true}); }
    this.toolsEl.querySelector('[data-act="next"]').hidden = this.ended;
    this.toolsEl.querySelector('[data-act="skip"]').hidden = this.ended;
    if (this.bench && now - (this.bench.lastSample || 0) > 1000) {
      this.bench.lastSample = now;
      this.bench.samples.push({t: Math.round(this.t), ...this.perf.summary(this.renderer)});
    }
    if (this.hudOn && now - this.lastHud > 250) { this.lastHud = now; this._hud(); }
    if (now - this.lastState > 90) { this.lastState = now; this.onState(this.state()); }
  }

  state() {
    return {t: this.t, duration: this.tl?.duration || 0, playing: this.playing, ended: this.ended, current: this.lastFrame?.current ?? -1, rate: this.rate, engine: this.engine, quality: this.renderer.quality, reduced: this.reduced, audio: this.audio.running ? (this.muted ? 'stumm' : 'an') : 'aus'};
  }
  _hud() {
    const s = this.perf.summary(this.renderer);
    this.hudEl.textContent = [
      `${this.engine} · Qualität ${s.quality}${this.autoQuality ? ' (auto)' : ''}`,
      `${s.fps} fps · Bild p95 ${s.frameP95} ms`,
      `CPU ${s.cpuMs} ms/Bild · GPU ${s.gpuMs == null ? 'n. v.' : s.gpuMs + ' ms'}`,
      `Pixel ${(s.canvasPx / 1e6).toFixed(2)} M · Nebel ${(s.fogPx / 1e6).toFixed(2)} M`,
      `Lange Aufgaben ${s.longTasks}`,
    ].join('\n');
  }

  /** Lesbarkeit: Kontrast der aktuell vollständig sichtbaren Worte gegen den gerenderten Hintergrund (WCAG-Formel). */
  measureContrast() {
    if (!this.renderer.sampleLuminance || !this.lastFrame) return [];
    this.renderer.render(this.lastFrame, this.ambient, 0);
    const color = this.type.text.color.replace('#', '');
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(color.slice(i, i + 2), 16)));
    const Lt = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return this.text.visibleRects().map(rect => {
      const L = this.renderer.sampleLuminance(rect);
      if (!L) return null;
      const ratio = bg => +((Lt + 0.05) / (bg + 0.05)).toFixed(2);
      return {key: rect.key, role: rect.role, contrastMean: ratio(L.mean), contrastP95: ratio(L.p95), bgMean: +L.mean.toFixed(4), bgP95: +L.p95.toFixed(4)};
    }).filter(Boolean);
  }

  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.audio.stop(0.1); this.renderer.destroy(); }
}
