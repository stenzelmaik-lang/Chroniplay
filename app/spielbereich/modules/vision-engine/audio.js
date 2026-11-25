/**
 * Klang der Vision mit Web Audio. Zwei geloopte Klangebenen (Atmosphäre, Herzschlag/Erinnerung)
 * mit nahtloser Überblendung, dazu erzeugte Effektklänge ohne Audiodateien und ohne Lizenzfragen:
 * Anschwellen beim Erinnerungsblitz, gedämpfter Schlag beim Lichtimpuls, Flirren und Knistern beim Auflösen,
 * ein tiefer Ton unter dem Schlusssatz. Alle Einsätze kommen aus demselben Zeitplan wie Bild und Text
 * und werden mit kurzer Vorausschau auf der Audio-Uhr geplant (sample-genau, unabhängig von Bildrate).
 */
import {clamp01} from './timeline.js';

const LOOP_XF = 1.6;

export class VisionAudio {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.muted = false; this.volume = 0.8;
    this.loops = []; this.cueNodes = new Set(); this.playing = false; this.rate = 1; this.skipUntil = null;
    this.lastCueT = -Infinity; this.lastAuto = 0; this.type = null; this.tl = null; this.droneNodes = [];
  }
  get available() { return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext); }
  get running() { return this.ctx?.state === 'running'; }

  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    const ctx = new C({latencyHint: 'playback'});
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);
    this.bedFilter = ctx.createBiquadFilter(); this.bedFilter.type = 'lowpass'; this.bedFilter.frequency.value = 16000; this.bedFilter.Q.value = 0.4;
    this.bedFilter.connect(this.master);
    this.bedGain = ctx.createGain(); this.bedGain.gain.value = 0; this.bedGain.connect(this.bedFilter);
    this.heartGain = ctx.createGain(); this.heartGain.gain.value = 0; this.heartGain.connect(this.bedFilter);
    this.fxGain = ctx.createGain(); this.fxGain.gain.value = 0.9; this.fxGain.connect(this.master);
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    return ctx;
  }

  /** urls: {bed, heart}. Fehlende Dateien sind erlaubt; dann bleiben nur die erzeugten Effektklänge. */
  async load(urls) {
    const ctx = this.ensure();
    if (!ctx) return {};
    const result = {};
    await Promise.all(Object.entries(urls).map(async ([key, url]) => {
      if (!url) { this.buffers.delete(key); return; }
      if (this.buffers.get(key)?.url === url) { result[key] = 'ok'; return; }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(key, {url, buf});
        result[key] = 'ok';
      } catch { this.buffers.delete(key); result[key] = 'fehlt'; }
    }));
    return result;
  }

  async unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch { /* Browser blockiert ohne Geste */ } }
    return this.running;
  }

  setType(type) { this.type = type; }
  setMuted(m) { this.muted = m; this._applyMaster(0.4); }
  setVolume(v) { this.volume = v; this._applyMaster(0.2); }
  _applyMaster(tc) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.playing && !this.muted ? this.volume : 0, now, tc / 3);
  }

  start(tl, t) {
    if (!this.ensure()) return;
    this.tl = tl; this.playing = true;
    this._stopLoops(0.3); this.cancelCues();
    this.lastCueT = t - 1;
    this._applyMaster(1.2);
    const now = this.ctx.currentTime + 0.04;
    for (const [key, gain] of [['bed', this.bedGain], ['heart', this.heartGain]]) {
      const b = this.buffers.get(key)?.buf;
      if (!b) continue;
      const loop = {key, buf: b, gain, sources: [], nextStart: 0};
      this._loopSource(loop, now, (t / 1000) % b.duration, 0.4);
      this.loops.push(loop);
    }
    this.bedGain.gain.cancelScheduledValues(now);
    this.bedGain.gain.setValueAtTime(0, now);
    this.bedGain.gain.linearRampToValueAtTime(0.5, now + 2.8);
  }
  _loopSource(loop, when, offset, fadeIn) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = loop.buf;
    const g = ctx.createGain();
    src.connect(g).connect(loop.gain);
    const end = when + (loop.buf.duration - offset);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + fadeIn);
    g.gain.setValueAtTime(1, Math.max(when + fadeIn, end - LOOP_XF));
    g.gain.linearRampToValueAtTime(0, end);
    src.start(when, offset); src.stop(end + 0.05);
    loop.sources.push({src, end});
    loop.nextStart = end - LOOP_XF;
  }
  _stopLoops(fade) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const loop of this.loops) for (const s of loop.sources) { try { s.src.stop(now + fade); } catch { /* bereits beendet */ } }
    this.loops = [];
  }

  /** Läuft je Bild: plant Effektklänge mit Vorausschau und steuert Herzschlag und Dämpfung. */
  tick(t, frame) {
    if (!this.playing || !this.running || !this.tl) return;
    const ctx = this.ctx, now = ctx.currentTime;
    for (const loop of this.loops) {
      if (loop.nextStart - now < 1.0) this._loopSource(loop, loop.nextStart, 0, LOOP_XF);
      loop.sources = loop.sources.filter(s => s.end > now - 0.2);
    }
    const horizon = t + 600 * this.rate;
    for (const c of this.tl.cues) {
      if (c.t <= this.lastCueT || c.t > horizon) continue;
      if (this.skipUntil !== null && c.t < this.skipUntil) continue;
      if (c.type === 'bed') continue;
      this._cue(c, now + Math.max(0, (c.t - t) / 1000 / this.rate));
    }
    this.lastCueT = Math.max(this.lastCueT, horizon);
    if (now - this.lastAuto > 0.08) {
      this.lastAuto = now;
      const A = this.type.audio;
      this.heartGain.gain.setTargetAtTime(0.05 + 0.55 * A.heart * frame.heart, now, 0.3);
      const f = 16000 * Math.pow(600 / 16000, clamp01(frame.muffle * A.muffle));
      this.bedFilter.frequency.setTargetAtTime(f, now, 0.35);
    }
  }

  seek(t) { this.cancelCues(); this.lastCueT = t - 1; }
  pause() { if (this.ctx && this.running) void this.ctx.suspend(); }
  resume() { if (this.ctx && this.playing) void this.ctx.resume(); }
  stop(fade = 1.2) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playing = false;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, fade / 3);
    this._stopLoops(fade);
    for (const n of this.droneNodes) { try { n.stop(now + fade); } catch { /* bereits beendet */ } }
    this.droneNodes = [];
  }
  cancelCues() {
    for (const n of this.cueNodes) { try { n.stop(); } catch { /* bereits beendet */ } }
    this.cueNodes.clear();
    for (const n of this.droneNodes) { try { n.stop(); } catch { /* bereits beendet */ } }
    this.droneNodes = [];
  }
  _track(node) { this.cueNodes.add(node); node.onended = () => { this.cueNodes.delete(node); node.disconnect(); }; return node; }

  _cue(c, when) {
    const A = this.type.audio;
    if (c.type === 'swell' && A.swell) this._swell(when, A.swell);
    else if (c.type === 'impact' && A.impact) this._impact(when, A.impact);
    else if (c.type === 'shimmer') { if (A.shimmer) this._shimmer(when, A.shimmer); if (A.crackle) this._crackle(when, A.crackle); }
    else if (c.type === 'drone' && A.drone) this._drone(when, A.drone);
  }
  _noise(when, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    src.start(when, Math.random() * 1.5); src.stop(when + dur);
    return this._track(src);
  }
  _env(g, when, peak, attack, total) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + total);
  }
  /** Erinnerungsblitz: rückwärts anschwellendes Rauschen und ein tiefer Unterton. */
  _swell(when, amt) {
    const ctx = this.ctx, dur = 1.9;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(180, when); bp.frequency.exponentialRampToValueAtTime(2600, when + 1.4);
    const g = ctx.createGain(); this._env(g, when, 0.2 * amt, 1.25, dur);
    this._noise(when, dur).connect(bp).connect(g).connect(this.fxGain);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(46, when); o.frequency.linearRampToValueAtTime(37, when + dur);
    const og = ctx.createGain(); this._env(og, when, 0.3 * amt, 1.1, dur + 0.4);
    o.connect(og).connect(this.fxGain); o.start(when); o.stop(when + dur + 0.5); this._track(o);
  }
  /** Gedämpfter Schlag zum Lichtimpuls. */
  _impact(when, amt) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(72, when); o.frequency.exponentialRampToValueAtTime(34, when + 0.5);
    const og = ctx.createGain(); this._env(og, when, 0.55 * amt, 0.012, 1.1);
    o.connect(og).connect(this.fxGain); o.start(when); o.stop(when + 1.2); this._track(o);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain(); this._env(g, when, 0.28 * amt, 0.006, 0.3);
    this._noise(when, 0.32).connect(lp).connect(g).connect(this.fxGain);
  }
  /** Auflösung: luftiges Flirren, beim Traum mit gläsernem Klang. */
  _shimmer(when, amt) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3600;
    const g = ctx.createGain(); this._env(g, when, 0.07 * amt, 0.5, 2.4);
    this._noise(when, 2.5).connect(hp).connect(g).connect(this.fxGain);
    if (this.type.id === 'dream' || this.type.id === 'classic') {
      for (const [f, k] of [[1318.5, 1], [1975.5, 0.6]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); this._env(og, when + 0.1, 0.018 * amt * k, 0.04, 2.6);
        o.connect(og).connect(this.fxGain); o.start(when + 0.1); o.stop(when + 2.8); this._track(o);
      }
    }
  }
  /** Erinnerungsecho: staubiges Knistern wie eine alte Platte. */
  _crackle(when, amt) {
    const ctx = this.ctx;
    for (let i = 0; i < 26; i++) {
      const at = when + Math.random() * 2.4, dur = 0.004 + Math.random() * 0.008;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2400; bp.Q.value = 1.2;
      const g = ctx.createGain(); this._env(g, at, (0.05 + Math.random() * 0.13) * amt, 0.001, dur + 0.01);
      this._noise(at, dur + 0.02).connect(bp).connect(g).connect(this.fxGain);
    }
  }
  /** Schlusssatz: tiefer, gehaltener Ton, der erst mit dem Ende der Vision ausklingt. */
  _drone(when, amt) {
    const ctx = this.ctx;
    for (const [f, d] of [[55, 0], [82.4, 4], [110, -3]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d;
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, when); og.gain.exponentialRampToValueAtTime(0.1 * amt * (f > 100 ? 0.4 : 1), when + 2.6);
      o.connect(og).connect(this.fxGain); o.start(when);
      this.droneNodes.push(o);
    }
  }
}
