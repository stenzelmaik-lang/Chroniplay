/**
 * WebGL2-Renderer der Vision Engine. Keine Abhängigkeiten.
 * Kennt nur Pixel, Texturen und Parameter; Zeitplan und Inhalt kommen vom Player.
 */
import {VERT, NOISE_FRAG, FOG_FRAG, COMPOSITE_FRAG, PARTICLE_VERT, PARTICLE_FRAG} from './shaders.js';

export const QUALITY = {
  hoch: {label: 'Hoch', dpr: 1.5, fogScale: 0.5, octaves: 5, particles: 1.0},
  mittel: {label: 'Mittel', dpr: 1.0, fogScale: 0.42, octaves: 4, particles: 0.7},
  niedrig: {label: 'Niedrig', dpr: 0.75, fogScale: 0.34, octaves: 3, particles: 0.4},
};
export const QUALITY_ORDER = ['niedrig', 'mittel', 'hoch'];
const MAX_PARTICLES = 600, BURST_PARTICLES = 160;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos'); // Vollbild-Dreieck immer auf Attribut 0
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('Programm: ' + gl.getProgramInfoLog(p));
  const locs = new Map();
  const loc = name => { if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name)); return locs.get(name); };
  return {p, loc};
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, k) => a + (b - a) * k;

/** Die tweenbaren Zahlenwerte eines Visionstyps, mit Intensität, Farbfilter und Ruhemodus verrechnet. */
export function shaderParams(type, {intensity = 1, filter = null, reduced = false} = {}) {
  const I = intensity, P = type.palette, F = type.fog, L = type.light, M = type.image, Q = type.post, K = type.particles;
  const r = reduced ? 0 : 1;
  return {
    bgTop: P.bgTop, bgBottom: P.bgBottom, fogA: P.fogA, fogB: P.fogB, front: P.front, light: P.light, glow: P.glow,
    fogDensity: Math.min(1.2, F.density * (0.75 + 0.25 * I)), fogFront: F.front * (0.7 + 0.3 * I), fogScale: F.scale, warp: F.warp,
    flow: F.flow, low: F.low, dark: F.dark, tendrils: F.tendrils * I * (reduced ? 0.5 : 1),
    lightPos: L.pos, lightDir: L.dir, spread: L.spread, rays: L.rays * (0.7 + 0.3 * I), lightInt: L.intensity, pulse: L.pulse * (reduced ? 0.3 : 1) * I, pulseHz: L.pulseHz,
    edgeNoise: M.edgeNoise, holes: M.holes * Math.min(1, I), breathe: reduced ? 0.2 : M.breathe,
    refract: M.refract * I * r, chroma: M.chroma * I * r, ghost: M.ghost * Math.min(1.2, I) * r, glowAmt: M.glow,
    filter: filter == null ? M.filter : filter, sat: M.sat, contrast: M.contrast, lift: M.lift, tintS: M.tintShadow, tintH: M.tintHigh,
    grain: Q.grain * (reduced ? 0.5 : 1), vignette: Q.vignette, flicker: Q.flicker * r,
    pColor: K.color, pSize: K.size, pSpeed: K.speed * (reduced ? 0.35 : 1), pAlpha: K.alpha, pBeam: K.beam,
    pCount: Math.round(K.count * Math.min(1.3, I) * (reduced ? 0.35 : 1)),
    dBand: reduced ? 0.24 : type.dissolve.band, dGlow: type.dissolve.glow * (reduced ? 0.5 : 1), dFlow: reduced ? 0 : type.dissolve.flow,
  };
}

export class VisionRenderer {
  constructor(canvas, {onLost} = {}) {
    this.canvas = canvas;
    this.onLost = onLost;
    this.images = new Map();
    this.quality = 'hoch';
    this.cssW = 1; this.cssH = 1; this.scale = 1; this.pixelCap = 1.5;
    this.lost = false;
    this.stats = {gpuMs: null, gpuSamples: [], fogPx: 0, canvasPx: 0, uploads: [], compileMs: 0, timer: false};
    const gl = canvas.getContext('webgl2', {antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance'});
    if (!gl) throw new Error('WEBGL2_UNAVAILABLE');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.onLost?.(true); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this._init(); for (const [key, img] of this.images) this._upload(key, img.source); this.onLost?.(false); });
    this._init();
  }

  _init() {
    const gl = this.gl;
    const t0 = performance.now();
    this.prog = {
      noise: program(gl, VERT, NOISE_FRAG),
      fog: program(gl, VERT, FOG_FRAG),
      comp: program(gl, VERT, COMPOSITE_FRAG),
      part: program(gl, PARTICLE_VERT, PARTICLE_FRAG),
    };
    this.stats.compileMs = Math.round(performance.now() - t0);
    this.ext = {float: gl.getExtension('EXT_color_buffer_float'), timer: gl.getExtension('EXT_disjoint_timer_query_webgl2')};
    this.stats.timer = !!this.ext.timer;
    this.queries = [];
    // Vollbild-Dreieck
    this.triVao = gl.createVertexArray();
    gl.bindVertexArray(this.triVao);
    const tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // Partikel: zufällige, feste Startwerte; Bewegung rechnet die GPU
    const rnd = seeded(20261125);
    const mk = n => { const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
    const aSeed = gl.getAttribLocation(this.prog.part.p, 'aSeed');
    const vaoFor = data => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aSeed); gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
      return vao;
    };
    this.partVao = vaoFor(mk(MAX_PARTICLES));
    this.burstVao = vaoFor(mk(BURST_PARTICLES));
    gl.bindVertexArray(null);
    this.pointMax = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
    // Rauschtextur einmalig auf der GPU backen
    this.noiseTex = this._texture(256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.REPEAT);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.noiseTex, 0);
    gl.viewport(0, 0, 256, 256);
    gl.useProgram(this.prog.noise.p);
    gl.uniform1f(this.prog.noise.loc('uPeriod'), 8);
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    this.black = this._texture(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.CLAMP_TO_EDGE, new Uint8Array([0, 0, 0, 255]));
    this.fog = null;
    this._resizeTargets();
  }

  _texture(w, h, internal, format, type, filter, wrap, data = null) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  /** Bühnengröße in CSS-Pixeln; pixelCap begrenzt die Pixeldichte (eingebettete Vorschau: nur so viele Pixel wie sichtbar). */
  setSize(cssW, cssH, pixelCap = Infinity) {
    this.cssW = Math.max(1, cssW); this.cssH = Math.max(1, cssH); this.pixelCap = pixelCap;
    this._resizeTargets();
  }
  setQuality(q) { if (QUALITY[q] && q !== this.quality) { this.quality = q; this._resizeTargets(); } }

  _resizeTargets() {
    const gl = this.gl;
    if (!gl || this.lost) return;
    const Q = QUALITY[this.quality];
    const dpr = Math.min(Q.dpr, window.devicePixelRatio || 1, this.pixelCap);
    const w = Math.max(2, Math.round(this.cssW * dpr)), h = Math.max(2, Math.round(this.cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.scale = w / this.cssW;
    const fw = Math.max(64, Math.round(w * Q.fogScale)), fh = Math.max(36, Math.round(h * Q.fogScale));
    if (this.fog && this.fog.w === fw && this.fog.h === fh) return;
    if (this.fog) { gl.deleteTexture(this.fog.tex); gl.deleteFramebuffer(this.fog.fbo); }
    const make = (internal, type) => {
      const tex = this._texture(fw, fh, internal, gl.RGBA, type, gl.LINEAR, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); return null; }
      return {tex, fbo, w: fw, h: fh, hdr: internal !== gl.RGBA8};
    };
    this.fog = (this.ext.float && make(gl.RGBA16F, gl.HALF_FLOAT)) || make(gl.RGBA8, gl.UNSIGNED_BYTE);
    this.stats.fogPx = fw * fh; this.stats.canvasPx = w * h; this.stats.hdrFog = this.fog.hdr;
  }

  /** Lädt ein Standbild als Textur mit Mipmaps. source: ImageBitmap oder HTMLImageElement. */
  setImage(key, source) {
    const prev = this.images.get(key);
    if (prev && prev.source === source) return;
    if (prev) this.gl.deleteTexture(prev.tex);
    this._upload(key, source);
  }
  _upload(key, source) {
    const gl = this.gl;
    const t0 = performance.now();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const w = source.width || source.naturalWidth, h = source.height || source.naturalHeight;
    this.images.set(key, {tex, w, h, source});
    this.stats.uploads.push({key, ms: Math.round((performance.now() - t0) * 10) / 10, w, h});
  }
  hasImage(key) { return this.images.has(key); }
  dropImage(key) { const i = this.images.get(key); if (i) { this.gl.deleteTexture(i.tex); this.images.delete(key); } }

  /** Neuer Zielwert; Übergänge zwischen Visionstypen werden weich überblendet. */
  setParams(params, immediate = false) {
    this.target = params;
    if (immediate || !this.cur) this.cur = structuredClone(params);
  }
  setDiscrete(d) { this.mode = d; }

  _tween(dt) {
    if (!this.target) return;
    const k = 1 - Math.exp(-dt / 0.55);
    for (const key in this.target) {
      const tv = this.target[key], cv = this.cur[key];
      if (Array.isArray(tv)) for (let i = 0; i < tv.length; i++) cv[i] = lerp(cv[i], tv[i], k);
      else if (typeof tv === 'number') this.cur[key] = key === 'pCount' ? tv : lerp(cv, tv, k);
    }
  }

  _gpuBegin() {
    const {timer} = this.ext;
    if (!timer || this.queries.length > 4) return null;
    const q = this.gl.createQuery();
    this.gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    return q;
  }
  _gpuEnd(q) {
    const gl = this.gl, {timer} = this.ext;
    if (q) { gl.endQuery(timer.TIME_ELAPSED_EXT); this.queries.push(q); }
    if (!this.queries.length) return;
    const first = this.queries[0];
    if (!gl.getQueryParameter(first, gl.QUERY_RESULT_AVAILABLE)) return;
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
    const ns = gl.getQueryParameter(first, gl.QUERY_RESULT);
    gl.deleteQuery(first); this.queries.shift();
    if (disjoint) return;
    const s = this.stats.gpuSamples; s.push(ns / 1e6); if (s.length > 120) s.shift();
    this.stats.gpuMs = s.reduce((a, b) => a + b, 0) / s.length;
  }

  /**
   * frame: {master, presence, slots:[{reveal, dissolve, flash, trans, imageKey, layout}], lightBoost, flash,
   *         burst:{slot, progress}, textShade:{x,y,w,h,amount}, escalation}; Geometrie in CSS-Pixeln.
   */
  render(frame, ambient, dt) {
    if (this.lost || !this.cur) return;
    const gl = this.gl, P = this.cur, D = this.mode || {};
    this._tween(dt);
    const W = this.canvas.width, H = this.canvas.height, s = this.scale, cssH = this.cssH, cssW = this.cssW;
    const Q = QUALITY[this.quality];
    const q = this._gpuBegin();
    const esc = frame.escalation || 0;
    const boost = (frame.lightBoost || 0);
    const li = P.lightInt * (1 + P.pulse * Math.sin(ambient * Math.PI * 2 * (D.pulseHz || 0.05))) * (1 + boost * 0.9) * (1 + esc * 0.35);

    // 1 · Nebel
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fog.fbo);
    gl.viewport(0, 0, this.fog.w, this.fog.h);
    const F = this.prog.fog; gl.useProgram(F.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(F.loc('uNoise'), 0);
    gl.uniform1f(F.loc('uTime'), ambient);
    gl.uniform1f(F.loc('uAspect'), cssW / cssH);
    gl.uniform1f(F.loc('uOctaves'), Q.octaves);
    gl.uniform1f(F.loc('uPresence'), frame.presence ?? 1);
    gl.uniform3fv(F.loc('uBgTop'), P.bgTop); gl.uniform3fv(F.loc('uBgBottom'), P.bgBottom);
    gl.uniform3fv(F.loc('uFogA'), P.fogA); gl.uniform3fv(F.loc('uFogB'), P.fogB); gl.uniform3fv(F.loc('uLightCol'), P.light);
    gl.uniform4f(F.loc('uFogP'), P.fogDensity * (1 + esc * 0.15), P.fogFront, P.fogScale, P.warp);
    gl.uniform4f(F.loc('uFlowP'), P.flow[0], P.flow[1], P.low, P.dark);
    gl.uniform4f(F.loc('uLightP'), P.lightPos[0], P.lightPos[1], P.spread, P.rays);
    gl.uniform4f(F.loc('uLightQ'), P.lightDir[0], P.lightDir[1], li, P.tendrils);
    for (let i = 0; i < 2; i++) {
      const sl = frame.slots?.[i];
      const name = i ? 'uOpen1' : 'uOpen0';
      if (sl && sl.layout) {
        const L = sl.layout;
        // Der Nebel öffnet sich nur um den Kern; im äußeren Bildbereich liegt er weiter davor und lässt das Bild aus ihm hervortreten
        gl.uniform4f(F.loc(name), L.focus.x / cssW, 1 - L.focus.y / cssH, (L.inner / cssH) * 0.9, 0.8 * sl.reveal * (1 - sl.dissolve));
      } else gl.uniform4f(F.loc(name), 0, 0, 0, 0);
    }
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2 · Komposition
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const C = this.prog.comp; gl.useProgram(C.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fog.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(C.loc('uFog'), 0); gl.uniform1i(C.loc('uNoise'), 1);
    gl.uniform2f(C.loc('uRes'), W, H);
    gl.uniform1f(C.loc('uTime'), ambient);
    gl.uniform1f(C.loc('uMaster'), frame.master ?? 1);
    let aspectX = 1.3;
    const core = [0, 0];
    for (let i = 0; i < 2; i++) {
      const sl = frame.slots?.[i];
      const img = sl && sl.layout ? this.images.get(sl.imageKey) : null;
      gl.activeTexture(gl.TEXTURE2 + i);
      gl.uniform1i(C.loc(i ? 'uImg1' : 'uImg0'), 2 + i);
      if (img) {
        const L = sl.layout; aspectX = L.aspectX; core[i] = (L.coreR || 0) * s;
        gl.bindTexture(gl.TEXTURE_2D, img.tex);
        const r = L.rect;
        gl.uniform4f(C.loc(i ? 'uRect1' : 'uRect0'), r.x * s, (cssH - (r.y + r.h)) * s, r.w * s, r.h * s);
        gl.uniform4f(C.loc(i ? 'uMask1' : 'uMask0'), L.focus.x * s, (cssH - L.focus.y) * s, L.innerF ?? 0.5, 0);
        gl.uniform4f(C.loc(i ? 'uState1' : 'uState0'), sl.reveal, sl.dissolve, sl.flash || 0, sl.trans || 0);
        gl.uniform1f(C.loc(i ? 'uLod1' : 'uLod0'), Math.max(0, Math.log2(img.h / Math.max(1, r.h * s))));
      } else {
        gl.bindTexture(gl.TEXTURE_2D, this.black);
        gl.uniform4f(C.loc(i ? 'uState1' : 'uState0'), 0, 0, 0, 0);
        gl.uniform4f(C.loc(i ? 'uRect1' : 'uRect0'), 0, 0, 0, 0);
      }
    }
    gl.uniform2f(C.loc('uCore'), core[0], core[1]);
    gl.uniform4f(C.loc('uShape'), aspectX, P.edgeNoise, P.holes, P.breathe);
    gl.uniform4f(C.loc('uFx'), P.refract, P.chroma, P.ghost, P.filter);
    gl.uniform4f(C.loc('uGrade'), P.sat, P.contrast * (1 + esc * 0.08), P.lift, P.glowAmt);
    gl.uniform3fv(C.loc('uTintS'), P.tintS); gl.uniform3fv(C.loc('uTintH'), P.tintH);
    gl.uniform3fv(C.loc('uGlow'), P.glow); gl.uniform3fv(C.loc('uFront'), P.front); gl.uniform3fv(C.loc('uLightCol'), P.light);
    gl.uniform4f(C.loc('uPost'), P.grain, P.vignette, P.flicker, esc);
    const ts = frame.textShade;
    if (ts && ts.amount > 0) {
      gl.uniform4f(C.loc('uTextShade'), (ts.x + ts.w / 2) * s, (cssH - (ts.y + ts.h / 2)) * s, (ts.w * 0.62 + 30) * s, (ts.h * 0.8 + 26) * s);
      gl.uniform1f(C.loc('uTextShadeAmt'), ts.amount);
    } else gl.uniform1f(C.loc('uTextShadeAmt'), 0);
    gl.uniform1f(C.loc('uFlashGlobal'), frame.flash || 0);
    gl.uniform1i(C.loc('uRevealMode'), D.reveal || 0);
    gl.uniform4f(C.loc('uLightGlow'), P.lightPos[0], P.lightPos[1], Math.min(1.6, li * 0.6), 0);
    gl.uniform2fv(C.loc('uSweepDir'), D.sweepDir || [1, 0]);
    gl.uniform4f(C.loc('uDiss'), P.dBand, P.dGlow, P.dFlow, 0);
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3 · Partikel
    const PP = this.prog.part; gl.useProgram(PP.p);
    gl.enable(gl.BLEND);
    if (D.additive === false) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(PP.loc('uNoise'), 0);
    gl.uniform2f(PP.loc('uRes'), W, H);
    gl.uniform1f(PP.loc('uTime'), ambient);
    gl.uniform1f(PP.loc('uDpr'), Math.min(s, this.pointMax / Math.max(1, P.pSize[1])));
    gl.uniform1f(PP.loc('uMaster'), (frame.master ?? 1) * (frame.presence ?? 1));
    gl.uniform1f(PP.loc('uAspectX'), aspectX);
    gl.uniform1i(PP.loc('uKind'), D.particleKind || 0);
    gl.uniform4f(PP.loc('uP'), P.pSize[0], P.pSize[1], P.pSpeed, P.pAlpha * (1 + esc * 0.4));
    gl.uniform4f(PP.loc('uLightP'), P.lightPos[0], P.lightPos[1], P.spread, P.pBeam);
    gl.uniform2fv(PP.loc('uLightDir'), P.lightDir);
    gl.uniform3fv(PP.loc('uColor'), P.pColor);
    gl.uniform1f(PP.loc('uBurstMode'), 0);
    const count = Math.min(MAX_PARTICLES, Math.round(P.pCount * Q.particles));
    if (count > 0) { gl.bindVertexArray(this.partVao); gl.drawArrays(gl.POINTS, 0, count); }
    const b = frame.burst, bs = b ? frame.slots?.[b.slot] : null;
    if (bs && bs.layout && P.pCount > 0) {
      const L = bs.layout;
      gl.uniform1f(PP.loc('uBurstMode'), 1);
      gl.uniform4f(PP.loc('uBurst'), L.focus.x * s, (cssH - L.focus.y) * s, L.inner * s * 1.25, b.progress);
      gl.uniform3fv(PP.loc('uColor'), D.additive === false ? [0.02, 0.02, 0.02] : P.glow);
      gl.uniform4f(PP.loc('uP'), 1.2, 3.2, 0, 0.8);
      gl.bindVertexArray(this.burstVao);
      gl.drawArrays(gl.POINTS, 0, Math.round(BURST_PARTICLES * Q.particles));
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    this._gpuEnd(q);
  }

  /** Mittlere Helligkeit eines Bereichs (CSS-Pixel) – für die Lesbarkeitsprüfung. Muss direkt nach render() laufen. */
  sampleLuminance(rect) {
    const gl = this.gl, s = this.scale;
    const x = Math.max(0, Math.round(rect.x * s)), w = Math.max(1, Math.round(rect.w * s));
    const yTop = Math.round(rect.y * s), h = Math.max(1, Math.round(rect.h * s));
    const y = Math.max(0, this.canvas.height - (yTop + h));
    const ww = Math.min(w, this.canvas.width - x), hh = Math.min(h, this.canvas.height - y);
    if (ww <= 0 || hh <= 0) return null;
    const px = new Uint8Array(ww * hh * 4);
    gl.readPixels(x, y, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    let sum = 0, max = 0, n = 0;
    const lum = [];
    for (let i = 0; i < px.length; i += 16) {
      const L = 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
      sum += L; n++; lum.push(L); if (L > max) max = L;
    }
    lum.sort((a, b) => a - b);
    return {mean: sum / n, p95: lum[Math.floor(lum.length * 0.95)] ?? max, max};
  }

  destroy() {
    const gl = this.gl;
    for (const k of this.images.keys()) this.dropImage(k);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
