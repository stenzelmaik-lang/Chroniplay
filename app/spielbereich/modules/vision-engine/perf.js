/**
 * Leistungsmessung: Bildintervalle, CPU-Zeit pro Bild (JavaScript inkl. Befehlsaufbau), GPU-Zeit
 * (falls der Browser EXT_disjoint_timer_query_webgl2 freigibt) und lange Aufgaben im Hauptthread.
 * Daraus folgt eine automatische Qualitätsstufe, damit schwächere Geräte flüssig bleiben.
 */
import {QUALITY_ORDER} from './engine.js';

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export class PerfMonitor {
  constructor() {
    this.intervals = []; this.cpu = []; this.longTasks = 0; this.lastEval = performance.now(); this.good = 0; this.changes = [];
    try {
      this.obs = new PerformanceObserver(list => { this.longTasks += list.getEntries().length; });
      this.obs.observe({type: 'longtask', buffered: false});
    } catch { this.obs = null; }
  }
  frame(interval, cpuMs) {
    if (interval > 0 && interval < 1000) { this.intervals.push(interval); if (this.intervals.length > 240) this.intervals.shift(); }
    this.cpu.push(cpuMs); if (this.cpu.length > 240) this.cpu.shift();
  }
  reset() { this.intervals = []; this.cpu = []; }
  summary(renderer) {
    const st = renderer?.stats || {};
    const mean = avg(this.intervals);
    return {
      fps: mean ? Math.round(1000 / mean) : 0,
      frameP50: +pct(this.intervals, 0.5).toFixed(1), frameP95: +pct(this.intervals, 0.95).toFixed(1),
      cpuMs: +avg(this.cpu).toFixed(2), cpuP95: +pct(this.cpu, 0.95).toFixed(2),
      gpuMs: st.gpuMs == null ? null : +st.gpuMs.toFixed(2),
      quality: renderer?.quality, canvasPx: st.canvasPx, fogPx: st.fogPx, longTasks: this.longTasks,
    };
  }
  /** Alle 2 s: bei Ruckeln eine Stufe herunter, bei dauerhaft viel Reserve eine Stufe hinauf. */
  evaluate(renderer, now = performance.now()) {
    if (now - this.lastEval < 2000 || this.intervals.length < 60 || document.visibilityState !== 'visible') return null;
    this.lastEval = now;
    const s = this.summary(renderer);
    const idx = QUALITY_ORDER.indexOf(renderer.quality);
    // Mit GPU-Zeitmessung entscheidet die echte Grafiklast; Bildintervalle können auch durch Drosselung des Browsers lang sein.
    const slow = s.gpuMs != null ? s.gpuMs > 12 : s.frameP95 > 24;
    const fast = s.gpuMs != null ? s.gpuMs < 6 : s.frameP95 < 18.5;
    let next = null;
    if (slow && idx > 0) { next = QUALITY_ORDER[idx - 1]; this.good = 0; }
    else if (fast && idx < QUALITY_ORDER.length - 1) { this.good++; if (this.good >= 3) { next = QUALITY_ORDER[idx + 1]; this.good = 0; } }
    else this.good = 0;
    if (next) { this.changes.push({at: Math.round(now), from: renderer.quality, to: next, frameP95: s.frameP95, gpuMs: s.gpuMs}); this.reset(); }
    return next;
  }
}
