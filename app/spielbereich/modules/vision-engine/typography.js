/**
 * Frei stehende Typografie ohne Container. Jedes Wort tritt einzeln aus der Dunkelheit,
 * wird lesbar und verblasst wieder. Werte sind eine reine Funktion der Zeit (vor- und zurückspulbar).
 * Lesbarkeit: mehrlagiger Textschatten plus ein unsichtbarer Kontrastschleier im Shader.
 * Bildschirmleser bekommen jeden Abschnitt einmal vollständig über eine Live-Region.
 */
import {clamp01, ease, echoIndices} from './timeline.js';

function shuffleOrder(n, seed) {
  const order = Array.from({length: n}, (_, i) => i);
  let s = seed * 9301 + 49297;
  for (let i = n - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rank = new Array(n); order.forEach((w, r) => { rank[w] = r; }); return rank;
}
const hashKey = k => { let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };

export class TextLayer {
  constructor(root, live) {
    this.root = root; this.live = live;
    this.items = new Map();
    this.type = null; this.reduced = false;
    this.announced = new Set();
  }
  setType(type) { this.type = type; this.root.dataset.type = type.id; this.root.style.setProperty('--vw-color', type.text.color); this.root.style.setProperty('--vw-glow', type.text.glow); }
  setReduced(r) { this.reduced = r; }
  clear() { for (const it of this.items.values()) it.el.remove(); this.items.clear(); this.announced.clear(); this.live.textContent = ''; }

  _create(x, placeOf) {
    const el = document.createElement('p');
    el.className = 'vw';
    el.dataset.role = x.role;
    el.dataset.place = placeOf(x);
    el.setAttribute('aria-hidden', 'true');
    const tokens = x.text.split(/(\s+)/);
    const echoSet = new Set(x.echo ? echoIndices(x.text, x.echo) : []);
    const words = [];
    let wi = 0;
    for (const tok of tokens) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); continue; }
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = tok;
      if (echoSet.has(wi)) span.dataset.echo = '1';
      el.appendChild(span);
      words.push({el: span, echo: echoSet.has(wi), last: ''});
      wi++;
    }
    this.root.appendChild(el);
    const it = {x, el, words, rank: shuffleOrder(words.length, hashKey(x.key)), place: el.dataset.place, rect: null};
    this._measure(it);
    return it;
  }
  /** Sichtbare Lage in Bühnenpixeln; berücksichtigt CSS-Zentrierung und die verkleinerte Vorschau im Ersteller. */
  _measure(it) {
    const sr = this.root.getBoundingClientRect(), er = it.el.getBoundingClientRect();
    const k = sr.width / (this.root.clientWidth || 1) || 1;
    it.rect = {x: (er.left - sr.left) / k, y: (er.top - sr.top) / k, w: er.width / k, h: er.height / k};
  }
  relayout(placeOf) { for (const it of this.items.values()) { const p = placeOf(it.x); if (p !== it.place) { it.el.dataset.place = p; it.place = p; } this._measure(it); } }

  /** t: Zeit im Ablauf (ms); items: aktive Texte aus frameAt; exitMs: Ausblenddauer. Liefert den Kontrastbereich. */
  update(t, items, exitMs, placeOf) {
    const T = this.type.text, red = this.reduced;
    const enter = red ? 700 : T.enterMs, stagger = red ? 40 : T.stagger;
    const wordIn = Math.max(380, enter * 0.75);
    const active = new Set();
    let shade = null, shadeAmt = 0;
    for (const x of items) {
      active.add(x.key);
      let it = this.items.get(x.key);
      if (!it) { it = this._create(x, placeOf); this.items.set(x.key, it); }
      if (!this.announced.has(x.key) && t >= x.inAt) { this.announced.add(x.key); this.live.textContent = x.text; }
      const n = it.words.length;
      const role = x.role;
      const big = role === 'echo' || role === 'final';
      let vis = 0;
      it.words.forEach((w, i) => {
        const d = t - x.inAt - i * stagger * (big ? 1.6 : 1);
        const pin = ease.outCubic(clamp01(d / wordIn));
        // unvollständige Erinnerung: Worte gehen in zufälliger Reihenfolge; der Nachhall bleibt stehen
        const outStart = w.echo ? x.echoOut : x.outAt + (T.incomplete && !red ? it.rank[i] * 110 : i * 35);
        const pout = ease.in(clamp01((t - outStart) / exitMs));
        const o = pin * (1 - pout);
        vis = Math.max(vis, o);
        let blur = 0, dx = 0, dy = 0, sc = 1, ghost = 0;
        if (!red) {
          blur = (1 - pin) * T.blur + pout * T.blur * 1.2;
          dy = (1 - pin) * T.y - pout * 14;
          dx = (1 - pin) * T.x * (i % 2 ? -1 : 1);
          if (T.wave) dy += Math.sin(d / 260 + i) * 5 * (1 - pin);
          if (T.jitter && pin < 1) { dx += Math.sin(d * 0.05 + i * 3.1) * 1.4 * (1 - pin); dy += Math.cos(d * 0.043 + i) * 1.1 * (1 - pin); }
          sc = 1 + (T.scale - 1) * (1 - pin);
          ghost = T.ghost ? (1 - pin) + pout * 0.6 : 0;
          if (w.echo && t > x.outAt) { const k = clamp01((t - x.outAt) / 900); sc *= 1 + 0.04 * k * (1 - pout); }
        }
        const style = `${o.toFixed(3)}|${blur.toFixed(1)}|${dx.toFixed(1)}|${dy.toFixed(1)}|${sc.toFixed(3)}|${ghost.toFixed(2)}`;
        if (style !== w.last) {
          w.last = style;
          const s = w.el.style;
          s.opacity = o.toFixed(3);
          s.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
          s.transform = dx || dy || sc !== 1 ? `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(3)})` : '';
          s.setProperty('--ghost', ghost.toFixed(2));
          if (w.echo) w.el.classList.toggle('is-echo', t > x.outAt);
        }
      });
      if (n && vis > 0.02 && it.rect) {
        const r = it.rect;
        shade = shade ? {x: Math.min(shade.x, r.x), y: Math.min(shade.y, r.y), w: Math.max(shade.x + shade.w, r.x + r.w) - Math.min(shade.x, r.x), h: Math.max(shade.y + shade.h, r.y + r.h) - Math.min(shade.y, r.y)} : {...r};
        shadeAmt = Math.max(shadeAmt, vis);
      }
    }
    for (const [key, it] of this.items) if (!active.has(key)) { it.el.remove(); this.items.delete(key); }
    return shade ? {...shade, amount: shadeAmt} : null;
  }

  /** Sichtbare Wortflächen (für die Kontrastprüfung). */
  visibleRects() {
    const out = [];
    for (const it of this.items.values()) {
      const shown = it.words.some(w => parseFloat(w.el.style.opacity || '0') > 0.95);
      if (shown && it.rect) out.push({key: it.x.key, role: it.x.role, ...it.rect});
    }
    return out;
  }
}
