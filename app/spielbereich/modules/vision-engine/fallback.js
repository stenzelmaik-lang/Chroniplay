/**
 * Einfacher Ersatz ohne WebGL2 (Canvas 2D). Gleiche Schnittstelle wie VisionRenderer.
 * Weiche radiale Masken, überblendete Nebelflecken, keine Shader-Effekte. Inhalt und Ablauf bleiben vollständig.
 */
const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const rgba = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

export class FallbackRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', {alpha: false});
    if (!this.g) throw new Error('CANVAS_UNAVAILABLE');
    this.images = new Map();
    this.quality = 'mittel'; this.cssW = 1; this.cssH = 1; this.scale = 1;
    this.off = document.createElement('canvas');
    this.stats = {gpuMs: null, uploads: [], compileMs: 0, timer: false, fallback: true, fogPx: 0, canvasPx: 0};
  }
  setSize(w, h, cap = Infinity) {
    this.cssW = Math.max(1, w); this.cssH = Math.max(1, h);
    const dpr = Math.min(1, window.devicePixelRatio || 1, cap);
    this.canvas.width = Math.round(this.cssW * dpr); this.canvas.height = Math.round(this.cssH * dpr);
    this.scale = this.canvas.width / this.cssW;
    this.stats.canvasPx = this.canvas.width * this.canvas.height;
  }
  setQuality() {}
  setImage(key, source) { this.images.set(key, {source, w: source.width, h: source.height}); }
  hasImage(key) { return this.images.has(key); }
  dropImage(key) { this.images.delete(key); }
  setParams(p) { this.p = p; }
  setDiscrete(d) { this.mode = d; }
  render(frame, ambient) {
    const g = this.g, P = this.p, s = this.scale, W = this.canvas.width, H = this.canvas.height;
    if (!P) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, css(P.bgTop)); bg.addColorStop(1, css(P.bgBottom));
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const presence = frame.presence ?? 1;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.5 + 0.38 * Math.sin(ambient * 0.05 + i * 1.7)), y = H * (0.5 + 0.3 * Math.cos(ambient * 0.04 + i * 2.3));
      const r = Math.max(W, H) * (0.35 + 0.1 * i);
      const fg = g.createRadialGradient(x, y, 0, x, y, r);
      fg.addColorStop(0, rgba(P.fogA, 0.16 * P.fogDensity * presence)); fg.addColorStop(1, rgba(P.fogA, 0));
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
    }
    for (const sl of frame.slots || []) {
      const img = sl && sl.layout ? this.images.get(sl.imageKey) : null;
      if (!img) continue;
      const L = sl.layout, r = L.rect;
      const a = sl.reveal * (1 - sl.dissolve);
      if (a <= 0.003) continue;
      const ow = Math.round(r.w * s), oh = Math.round(r.h * s);
      if (this.off.width !== ow || this.off.height !== oh) { this.off.width = ow; this.off.height = oh; }
      const o = this.off.getContext('2d');
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, ow, oh);
      o.drawImage(img.source, 0, 0, ow, oh);
      o.globalCompositeOperation = 'destination-in';
      const fx = (L.focus.x - r.x) * s, fy = (L.focus.y - r.y) * s;
      o.setTransform(L.aspectX, 0, 0, 1, fx * (1 - L.aspectX), 0);
      const m = o.createRadialGradient(fx, fy, L.inner * s * 0.6, fx, fy, L.outer * s);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = m; o.fillRect(-ow, 0, ow * 3, oh);
      o.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = a;
      g.drawImage(this.off, r.x * s, r.y * s);
      g.globalAlpha = 1;
    }
    const ts = frame.textShade;
    if (ts && ts.amount > 0) {
      const cx = (ts.x + ts.w / 2) * s, cy = (ts.y + ts.h / 2) * s, rr = Math.max(ts.w, ts.h) * 0.8 * s;
      const sg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      sg.addColorStop(0, `rgba(0,0,0,${0.5 * ts.amount})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }
    const master = frame.master ?? 1;
    if (master < 1) { g.fillStyle = `rgba(0,0,0,${1 - master})`; g.fillRect(0, 0, W, H); }
  }
  sampleLuminance(rect) {
    const s = this.scale;
    const d = this.g.getImageData(Math.round(rect.x * s), Math.round(rect.y * s), Math.max(1, Math.round(rect.w * s)), Math.max(1, Math.round(rect.h * s))).data;
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    let sum = 0, n = 0, max = 0; const all = [];
    for (let i = 0; i < d.length; i += 16) { const L = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); sum += L; n++; all.push(L); max = Math.max(max, L); }
    all.sort((a, b) => a - b);
    return {mean: sum / n, p95: all[Math.floor(all.length * 0.95)] ?? max, max};
  }
  destroy() {}
}
