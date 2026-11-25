/**
 * Ersteller („Regie-Werkbank“) für Visionen.
 * Gegenüber dem bestehenden Editor: Live-Bühne statt Vorschaufenster, Storyboard mit Bild und Text als Paar,
 * Reihenfolge per Ziehen oder Pfeiltasten, Brennpunkt und geschützter Kernbereich je Bild, Platz und Größe je Moment,
 * Nachhall-Worte, Eintauchen und Schlusssatz, Intensität und Farbfilterstärke, Zeitleiste mit Sprungmarken,
 * Format-Vorschau (Desktop, Tablet, Handy), Prüfhinweise inklusive gemessener Lesbarkeit und Export ins Szenenformat.
 */
import {VisionPlayer} from '/engine/player.js';
import {VISION_TYPES, TEMPOS, INTENSITIES, SIZES, PLACES, typeById, tempoById} from '/engine/presets.js';
import {buildTimeline, readingMs, echoIndices, FLASH_MIN_GAP_MS} from '/engine/timeline.js';
import {defaultVision, toSceneWhisper} from './vision-default.js';

const STORE = 'chroniplay-vision-prototype-v1';
const FORMATS = {desktop: {w: 1440, h: 810, label: 'Desktop'}, tablet: {w: 1024, h: 768, label: 'Tablet'}, handy: {w: 390, h: 844, label: 'Handy'}};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const secs = ms => `${(ms / 1000).toLocaleString('de-DE', {maximumFractionDigits: 1})} s`;
const uid = () => 'm' + Math.random().toString(36).slice(2, 9);

function load() {
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.format === 'chroniplay-vision-direction' && Array.isArray(v.moments)) return withPool(v); } catch { /* Entwurf nur Komfort */ }
  return defaultVision();
}
/** Ältere Entwürfe ohne eigenen Bildbestand: genau die Bilder der eigenen Momente, nichts darüber hinaus. */
function withPool(v) {
  if (!Array.isArray(v.images)) v.images = [...new Map(v.moments.map(m => [m.image, {file: m.image, label: m.label || 'Bild'}])).values()];
  return v;
}
const local = list => (list || []).filter(i => !String(i.file ?? i.image).startsWith('blob:'));

export class Creator {
  constructor(root, {manifest = {images: [], audio: []}} = {}) {
    this.root = root; this.manifest = manifest;
    this.vision = load();
    // Bilder aus einer früheren Sitzung (nur im Speicher) sind nach dem Neuladen weg
    this.vision.moments = local(this.vision.moments);
    this.vision.images = local(this.vision.images);
    this.sel = 0; this.format = 'desktop'; this.confirmRemove = null; this.dragFrom = null;
    this._markup();
    this.player = new VisionPlayer(this.$('#c-stage'), {mode: 'embedded', onState: s => this._state(s)});
    this._wire();
    this._renderAll();
    void this._boot();
  }
  $(s) { return this.root.querySelector(s); }
  $$(s) { return [...this.root.querySelectorAll(s)]; }

  async _boot() {
    const {missing} = await this.player.load(this.vision);
    this._missing(missing);
    this.player.seekMoment(0);
    this._renderMarks();
    this._renderChecks();
  }
  _missing(missing) {
    const b = this.$('#c-banner');
    b.hidden = !missing.length;
    if (missing.length) b.innerHTML = `<strong>${missing.length} Bild${missing.length > 1 ? 'er' : ''} nicht gefunden.</strong> Die Originalbilder liegen nicht im Repository. Einmal ausführen: <code>powershell -File prototypes/vision-engine/prepare-assets.ps1</code>, danach diese Seite neu laden.`;
  }

  _markup() {
    this.root.innerHTML = `
<header class="c-top">
  <div class="c-brand"><span class="c-mark">ChroniPlay</span><span class="c-sub">Vision Engine · isolierter Prototyp</span></div>
  <label class="c-title"><span class="sr-only">Titel (nur für die Spielleitung)</span><input id="c-title" maxlength="160" autocomplete="off"></label>
  <div class="c-top-actions">
    <button type="button" class="c-btn c-btn--primary" data-act="fullscreen">Als Spieler ansehen</button>
    <button type="button" class="c-btn" data-act="export">Export</button>
    <label class="c-btn">Import<input type="file" id="c-import" accept="application/json" class="sr-only"></label>
    <button type="button" class="c-btn c-btn--ghost" data-act="reset">Zurücksetzen</button>
  </div>
</header>
<p class="c-banner" id="c-banner" role="status" hidden></p>
<main class="c-main">
  <section class="c-board" aria-labelledby="c-board-h">
    <div class="c-board-head"><h2 id="c-board-h">Ablauf</h2><span class="c-meta" id="c-duration"></span></div>
    <ol class="c-flow" id="c-flow"></ol>
    <div class="c-library">
      <h3>Bilder dieser Vision</h3>
      <p class="c-hint">Nur diese Bilder können in der Vision erscheinen. Klick legt einen neuen Moment an.</p>
      <div class="c-lib" id="c-lib"></div>
      <label class="c-btn c-btn--small">Bild für diese Vision von diesem Gerät …<input type="file" id="c-file" accept="image/*" class="sr-only"></label>
      <p class="c-hint">Eigene Bilder bleiben nur in dieser Sitzung im Browser. Nichts wird hochgeladen.</p>
      <details class="c-gallery" id="c-gallery"><summary>Galerie · andere Bilder <span id="c-gallery-count"></span></summary>
        <p class="c-hint">Bilder anderer Visionen und allgemeine Bilder. Sie erscheinen nie in dieser Vision, solange du sie nicht übernimmst.</p>
        <div class="c-lib" id="c-gallery-list"></div>
      </details>
    </div>
  </section>
  <section class="c-stagecol" aria-label="Bühne">
    <div class="c-frame-wrap" id="c-wrap"><div class="c-frame" id="c-frame"><div id="c-stage"></div></div></div>
    <div class="c-transport">
      <button type="button" class="c-round" data-act="play" id="c-play" aria-label="Abspielen">▶</button>
      <button type="button" class="c-btn c-btn--small" data-act="restart">Von vorn</button>
      <button type="button" class="c-btn c-btn--small" data-act="next">Weiter ›</button>
      <span class="c-time" id="c-time">0:00 / 0:00</span>
    </div>
    <div class="c-scrub"><input type="range" id="c-scrub" min="0" max="1000" step="1" value="0" aria-label="Zeitposition im Ablauf"><div class="c-marks" id="c-marks" aria-hidden="true"></div></div>
    <div class="c-viewopts">
      <div class="c-seg" role="radiogroup" aria-label="Bildschirmformat" id="c-format">${Object.entries(FORMATS).map(([k, f]) => `<button type="button" role="radio" data-format="${k}" aria-checked="${k === 'desktop'}">${f.label}</button>`).join('')}</div>
      <button type="button" class="c-btn c-btn--small" data-act="reduced" aria-pressed="false" id="c-reduced">Effekte ruhiger</button>
      <button type="button" class="c-btn c-btn--small" data-act="mute" aria-pressed="false" id="c-mute">Ton aus</button>
      <label class="c-inline">Lautstärke <input type="range" id="c-volume" min="0" max="1" step="0.05" value="0.8"></label>
      <label class="c-inline">Qualität <select id="c-quality"><option value="auto">Automatisch</option><option value="hoch">Hoch</option><option value="mittel">Mittel</option><option value="niedrig">Niedrig</option></select></label>
      <label class="c-inline"><input type="checkbox" id="c-hud"> Leistung</label>
    </div>
    <p class="c-perf" id="c-perf" aria-live="off"></p>
  </section>
  <aside class="c-inspector" aria-label="Einstellungen">
    <section class="c-panel" aria-labelledby="c-type-h">
      <h2 id="c-type-h">Visionstyp</h2>
      <div class="c-types" role="radiogroup" aria-labelledby="c-type-h" id="c-types"></div>
      <p class="c-lang" id="c-lang"></p>
    </section>
    <section class="c-panel" aria-labelledby="c-fx-h">
      <h2 id="c-fx-h">Wirkung</h2>
      <div class="c-field"><span class="c-label">Tempo der Texte</span><div class="c-seg" role="radiogroup" aria-label="Tempo" id="c-tempo"></div></div>
      <div class="c-field"><span class="c-label">Intensität</span><div class="c-seg" role="radiogroup" aria-label="Intensität" id="c-intensity"></div></div>
      <div class="c-field"><label class="c-label" for="c-filter">Farbfilter <span id="c-filter-val"></span></label><input type="range" id="c-filter" min="0" max="1" step="0.05"><button type="button" class="c-link" data-act="filter-default">Typ-Standard</button></div>
      <p class="c-hint">Intensität verändert Nebel, Licht, Partikel und Doppelkonturen. Das Bild selbst bleibt unbewegt, sein Kern immer klar.</p>
    </section>
    <section class="c-panel" id="c-detail" aria-live="off"></section>
    <section class="c-panel" aria-labelledby="c-audio-h">
      <h2 id="c-audio-h">Ton</h2>
      <label class="c-field c-label">Atmosphäre (Schleife)<select id="c-bed"></select></label>
      <label class="c-field c-label">Erinnerung / Herzschlag (schwillt mit jedem Bild an)<select id="c-heart"></select></label>
      <p class="c-hint">Anschwellen, Lichtschlag, Flirren und Knistern erzeugt die Engine selbst, passend zum Visionstyp und genau zum Bild.</p>
    </section>
    <section class="c-panel" aria-labelledby="c-check-h">
      <div class="c-board-head"><h2 id="c-check-h">Prüfung</h2><button type="button" class="c-btn c-btn--small" data-act="contrast">Lesbarkeit messen</button></div>
      <ul class="c-checks" id="c-checks"></ul>
    </section>
  </aside>
</main>
<div class="c-overlay" id="c-overlay" hidden><button type="button" class="c-close" data-act="close-overlay">‹ Zurück zum Ersteller</button><div id="c-play-stage"></div></div>`;
  }

  _wire() {
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.closest('.v-stage')) return;
      this._act(b.dataset.act, b);
    });
    this.$('#c-title').addEventListener('input', e => this.change(v => { v.title = e.target.value; }, {rebuild: false}));
    this.$('#c-scrub').addEventListener('input', e => { this.player.pause(); this.player.seek((Number(e.target.value) / 1000) * this.player.tl.duration); });
    this.$('#c-volume').addEventListener('input', e => this.player.setVolume(Number(e.target.value)));
    this.$('#c-quality').addEventListener('change', e => this.player.setQuality(e.target.value));
    this.$('#c-hud').addEventListener('change', e => this.player.setHud(e.target.checked));
    this.$('#c-filter').addEventListener('input', e => this.change(v => { v.filter = Number(e.target.value); }, {debounce: 60}));
    this.$('#c-format').addEventListener('click', e => { const b = e.target.closest('[data-format]'); if (b) this.setFormat(b.dataset.format); });
    this.$('#c-import').addEventListener('change', e => void this._import(e.target.files?.[0]));
    this.$('#c-file').addEventListener('change', e => this._addLocalImage(e.target.files?.[0]));
    for (const id of ['#c-bed', '#c-heart']) this.$(id).addEventListener('change', () => {
      this.change(v => { v.audio = {bed: this.$('#c-bed').value || '', heart: this.$('#c-heart').value || ''}; }, {rebuild: false});
      void this.player.setAudio(this.vision.audio);
    });
    this.ro = new ResizeObserver(() => this._fit());
    this.ro.observe(this.$('#c-wrap'));
    document.addEventListener('keydown', e => {
      if (!this.$('#c-overlay').hidden) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); this.player.toggle(); }
      if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); this.player.next(); }
    });
  }

  _act(a, el) {
    const p = this.player;
    if (a === 'play') p.toggle();
    else if (a === 'restart') { p.seek(0); p.play(); }
    else if (a === 'next') p.next();
    else if (a === 'reduced') { p.setOwnReduced(!p.ownReduced); el.setAttribute('aria-pressed', String(p.ownReduced)); this._renderMarks(); this._renderChecks(); }
    else if (a === 'mute') { p.setMuted(!p.muted); el.setAttribute('aria-pressed', String(p.muted)); el.textContent = p.muted ? 'Ton an' : 'Ton aus'; }
    else if (a === 'fullscreen') this.openPlayer();
    else if (a === 'close-overlay') this.closePlayer();
    else if (a === 'export') this._export();
    else if (a === 'reset') { if (confirm('Den Prototyp auf „Der Hunger folgt dir“ zurücksetzen? Eigene Änderungen gehen verloren.')) { this.vision = defaultVision(); this.sel = 0; this._persist(); this._renderAll(); void this._boot(); } }
    else if (a === 'filter-default') this.change(v => { v.filter = null; });
    else if (a === 'contrast') this._measureContrast();
    else if (a === 'select') this.select(el.dataset.sel === 'intro' || el.dataset.sel === 'finale' ? el.dataset.sel : Number(el.dataset.sel));
    else if (a === 'up' || a === 'down') this.move(Number(el.dataset.i), a === 'up' ? -1 : 1);
    else if (a === 'add-image') this.addMoment(el.dataset.src, el.dataset.label);
    else if (a === 'adopt-image') this.change(v => { if (!v.images.some(i => i.file === el.dataset.src)) v.images.push({file: el.dataset.src, label: el.dataset.label}); }, {rebuild: false, after: () => { this._renderLibrary(); this._renderDetail(); }});
    else if (a === 'drop-image') this.change(v => { v.images = v.images.filter(i => i.file !== el.dataset.src); }, {rebuild: false, after: () => { this._renderLibrary(); this._renderDetail(); }});
    else if (a === 'remove') { this.confirmRemove = Number(el.dataset.i); this._renderDetail(); }
    else if (a === 'remove-yes') this.removeMoment(Number(el.dataset.i));
    else if (a === 'remove-no') { this.confirmRemove = null; this._renderDetail(); }
    else if (a === 'type') this.change(v => { v.type = el.dataset.id; }, {after: () => this._renderTypes()});
    else if (a === 'tempo') this.change(v => { v.tempo = el.dataset.id; }, {after: () => this._renderEffect()});
    else if (a === 'intensity') this.change(v => { v.intensity = el.dataset.id; }, {after: () => this._renderEffect()});
    else if (a === 'size' || a === 'place') this.change(v => { v.moments[this.sel][a] = el.dataset.id; }, {after: () => { this._renderDetail(); this.player.seekMoment(this.sel); }});
  }

  /** Jede Änderung: Entwurf sichern, Ablauf neu berechnen, betroffene Bereiche neu zeichnen. */
  change(mutate, {rebuild = true, debounce = 0, after, flow = true} = {}) {
    mutate(this.vision);
    this._persist();
    after?.();
    if (flow) this._renderFlow();
    if (!rebuild) return;
    clearTimeout(this.rebuildTimer);
    const run = async () => {
      await this.player.ensureImages(this.vision);
      const keep = this.player.state();
      this.player.rebuild();
      if (!keep.playing && typeof this.sel === 'number') this.player.seekMoment(this.sel);
      this._renderMarks();
      this._renderChecks();
    };
    if (debounce) this.rebuildTimer = setTimeout(run, debounce); else void run();
  }
  _persist() { try { localStorage.setItem(STORE, JSON.stringify({...this.vision, moments: local(this.vision.moments), images: local(this.vision.images)})); } catch { /* Entwurf nur Komfort */ } }

  select(sel) {
    this.sel = sel; this.confirmRemove = null;
    this._renderFlow(); this._renderDetail();
    const p = this.player;
    if (!p.tl) return;
    p.pause();
    if (typeof sel === 'number') p.seekMoment(sel);
    else if (sel === 'intro') { const x = p.tl.texts.find(t => t.key === 'intro'); p.seek(x ? x.inAt + p.tl.textEnter + 300 : 400); }
    else { const x = p.tl.texts.find(t => t.key === 'final'); p.seek(x ? x.inAt + p.tl.textEnter + 600 : p.tl.duration); }
  }
  move(i, d) {
    const j = i + d, list = this.vision.moments;
    if (j < 0 || j >= list.length) return;
    this.change(v => { [v.moments[i], v.moments[j]] = [v.moments[j], v.moments[i]]; }, {after: () => { if (this.sel === i) this.sel = j; else if (this.sel === j) this.sel = i; }});
    this._renderDetail();
    requestAnimationFrame(() => this.$(`.c-step[data-i="${j}"] [data-act="${d < 0 ? 'up' : 'down'}"]`)?.focus());
  }
  addMoment(src, label) {
    if (this.vision.moments.length >= 20) return;
    this.change(v => { v.moments.push({id: uid(), image: src, label: label || 'Neuer Moment', focus: {x: 0.5, y: 0.45}, core: 0.36, size: 'mittel', place: 'mitte', text: '', echo: '', holdMs: 0}); },
      {after: () => { this.sel = this.vision.moments.length - 1; }});
    this._renderDetail();
  }
  removeMoment(i) {
    this.confirmRemove = null;
    this.change(v => { v.moments.splice(i, 1); }, {after: () => { this.sel = Math.min(i, this.vision.moments.length - 1); if (this.sel < 0) this.sel = 'intro'; }});
    this._renderDetail();
  }
  _addLocalImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    // an der Vision hochgeladen: gehört zu dieser Vision
    this.change(v => { v.images.push({file: url, label: file.name.replace(/\.[^.]+$/, '')}); }, {rebuild: false, after: () => { this._renderLibrary(); this._renderDetail(); }});
  }

  setFormat(f) {
    this.format = f;
    this.$$('#c-format [data-format]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.format === f)));
    this._fit();
  }
  _fit() {
    const wrap = this.$('#c-wrap'), frame = this.$('#c-frame'), F = FORMATS[this.format];
    const availW = wrap.clientWidth, availH = Math.max(260, Math.min(window.innerHeight * 0.62, 760));
    const k = Math.min(availW / F.w, availH / F.h, 1);
    frame.style.width = F.w + 'px'; frame.style.height = F.h + 'px';
    frame.style.transform = `scale(${k})`;
    wrap.style.height = Math.round(F.h * k) + 'px';
    frame.style.left = Math.max(0, Math.round((availW - F.w * k) / 2)) + 'px';
    this.player?.setDisplayScale(k);
  }

  openPlayer() {
    const ov = this.$('#c-overlay');
    this.player.pause();
    ov.hidden = false;
    this.overlayPlayer = new VisionPlayer(this.$('#c-play-stage'), {mode: 'play', onEnd: () => this.closePlayer()});
    this.overlayPlayer.setMuted(this.player.muted);
    this.overlayPlayer.setVolume(Number(this.$('#c-volume').value));
    this.overlayPlayer.setQuality(this.$('#c-quality').value);
    this.overlayPlayer.setHud(this.$('#c-hud').checked);
    this.player.suspended = true; cancelAnimationFrame(this.player.raf);
    ov.requestFullscreen?.().catch(() => { /* Vollbild ist optional */ });
    void this.overlayPlayer.load(this.vision).then(() => { this.overlayPlayer.play(); this.overlayPlayer.stage.focus({preventScroll: true}); });
  }
  closePlayer() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    this.overlayPlayer?.destroy(); this.overlayPlayer = null;
    this.$('#c-play-stage').replaceChildren();
    this.$('#c-overlay').hidden = true;
    this.player.raf = requestAnimationFrame(this.player._loop);
    this.$('[data-act="fullscreen"]').focus();
  }

  _state(s) {
    const play = this.$('#c-play');
    play.textContent = s.playing && !s.ended ? '❚❚' : '▶';
    play.setAttribute('aria-label', s.playing && !s.ended ? 'Anhalten' : 'Abspielen');
    this.$('#c-time').textContent = `${clock(s.t)} / ${clock(s.duration)}`;
    if (document.activeElement !== this.$('#c-scrub')) this.$('#c-scrub').value = String(s.duration ? Math.round((s.t / s.duration) * 1000) : 0);
    if (s.current !== this.lastCurrent) {
      this.lastCurrent = s.current;
      this.$$('.c-step').forEach(li => li.classList.toggle('is-live', li.dataset.i === String(s.current)));
    }
    if (!this.perfAt || performance.now() - this.perfAt > 1000) {
      this.perfAt = performance.now();
      const p = this.player.perf.summary(this.player.renderer);
      this.$('#c-perf').textContent = `${s.engine === 'webgl2' ? 'WebGL2' : 'Einfache Darstellung'} · ${p.fps} fps · Bild p95 ${p.frameP95} ms · CPU ${p.cpuMs} ms · GPU ${p.gpuMs == null ? 'nicht messbar' : p.gpuMs + ' ms'} · Qualität ${p.quality} · Ton ${s.audio}`;
    }
  }

  /* ------------------------------------------------------------------ Darstellung */
  _renderAll() {
    this.$('#c-title').value = this.vision.title || '';
    this._renderFlow(); this._renderLibrary(); this._renderTypes(); this._renderEffect(); this._renderDetail(); this._renderAudio(); this._renderChecks();
    this._fit();
  }

  _renderFlow() {
    const v = this.vision, type = typeById(v.type);
    const tl = buildTimeline(v, {reduced: this.player?.reduced});
    this.$('#c-duration').textContent = `${v.moments.length} Momente · ${clock(tl.duration)}`;
    const step = (sel, no, title, sub, extra = '') => `<li class="c-step c-step--fixed${this.sel === sel ? ' is-sel' : ''}"><button type="button" class="c-step-sel" data-act="select" data-sel="${sel}" aria-pressed="${this.sel === sel}"><span class="c-step-no">${no}</span><span class="c-step-txt"><strong>${title}</strong><small>${esc(sub) || '<em>ohne Text</em>'}</small></span>${extra}</button></li>`;
    const items = v.moments.map((m, i) => {
      const tm = tl.moments[i];
      const dur = tm ? secs(tm.dissolveEnd - tm.emergeStart) : '';
      const echoIn = m.echo && echoIndices(m.text, m.echo).length;
      return `<li class="c-step${this.sel === i ? ' is-sel' : ''}" data-i="${i}" draggable="true">
        <span class="c-grip" aria-hidden="true" title="Ziehen zum Umsortieren">⋮⋮</span>
        <button type="button" class="c-step-sel" data-act="select" data-sel="${i}" aria-pressed="${this.sel === i}">
          <span class="c-thumb"><img src="${esc(m.image)}" alt="" loading="lazy" decoding="async"></span>
          <span class="c-step-txt"><strong>${String(i + 2).padStart(2, '0')} · ${esc(m.label || 'Moment')}</strong><small>${esc(m.text) || '<em>nur Bild</em>'}</small>
            <span class="c-chips">${m.echo ? `<span class="c-chip" title="${echoIn ? 'Bleibt aus dem Satz stehen' : 'Erscheint als eigenes Wort'}">Nachhall: ${esc(m.echo)}</span>` : ''}<span class="c-chip c-chip--muted">${esc(PLACES.find(p => p.id === m.place)?.label || 'Mitte')} · ${esc(SIZES.find(s => s.id === m.size)?.label || 'Mittel')}</span><span class="c-chip c-chip--muted">${dur}</span></span>
          </span>
        </button>
        <span class="c-step-move"><button type="button" class="c-icon" data-act="up" data-i="${i}" aria-label="Moment ${i + 1} nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="c-icon" data-act="down" data-i="${i}" aria-label="Moment ${i + 1} nach unten" ${i === v.moments.length - 1 ? 'disabled' : ''}>↓</button></span>
      </li>`;
    }).join('');
    this.$('#c-flow').innerHTML = step('intro', '01', 'Eintauchen', v.intro?.text) + items + step('finale', String(v.moments.length + 2).padStart(2, '0'), 'Abschluss', v.finale?.text);
    this.$('#c-flow').dataset.type = type.id;
    this._wireDrag();
  }
  _wireDrag() {
    this.$$('.c-step[draggable="true"]').forEach(li => {
      li.addEventListener('dragstart', e => { this.dragFrom = Number(li.dataset.i); li.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.dataset.i); });
      li.addEventListener('dragend', () => { li.classList.remove('is-drag'); this.$$('.c-step').forEach(x => x.classList.remove('is-over')); });
      li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('is-over'); });
      li.addEventListener('dragleave', () => li.classList.remove('is-over'));
      li.addEventListener('drop', e => {
        e.preventDefault();
        const from = this.dragFrom, to = Number(li.dataset.i);
        if (from === null || from === to) return;
        this.change(v => { const [m] = v.moments.splice(from, 1); v.moments.splice(to, 0, m); }, {after: () => { this.sel = to; }});
        this._renderDetail();
      });
    });
  }
  /** Bildbestand dieser Vision und getrennte Galerie aller übrigen Bilder. */
  _renderLibrary() {
    const pool = this.vision.images || [];
    const used = new Set(this.vision.moments.map(m => m.image));
    this.$('#c-lib').innerHTML = pool.length ? pool.map(i => `<div class="c-libitem"><button type="button" class="c-libpick" data-act="add-image" data-src="${esc(i.file)}" data-label="${esc(i.label)}" aria-label="Neuer Moment mit ${esc(i.label)}"><img src="${esc(i.file)}" alt="" loading="lazy" decoding="async"><span>+ ${esc(i.label)}</span></button>${used.has(i.file) ? '<small class="c-libnote">im Ablauf</small>' : `<button type="button" class="c-link c-libdrop" data-act="drop-image" data-src="${esc(i.file)}">aus der Vision entfernen</button>`}</div>`).join('') : '<p class="c-hint">Diese Vision hat noch keine eigenen Bilder.</p>';
    const inPool = new Set(pool.map(i => i.file));
    const gallery = (this.manifest.images || []).map(i => ({file: 'local-assets/' + i.file, label: i.label, vision: i.vision || ''})).filter(i => !inPool.has(i.file));
    this.$('#c-gallery-count').textContent = `(${gallery.length})`;
    this.$('#c-gallery-list').innerHTML = gallery.length ? gallery.map(i => `<div class="c-libitem"><img src="${esc(i.file)}" alt="" loading="lazy" decoding="async"><span>${esc(i.label)}${i.vision ? ` · aus „${esc(i.vision)}“` : ''}</span><button type="button" class="c-link" data-act="adopt-image" data-src="${esc(i.file)}" data-label="${esc(i.label)}">In diese Vision übernehmen</button></div>`).join('') : '<p class="c-hint">Keine weiteren Bilder in der Galerie.</p>';
  }
  _renderTypes() {
    const cur = this.vision.type;
    this.$('#c-types').innerHTML = VISION_TYPES.map(t => `<button type="button" role="radio" aria-checked="${t.id === cur}" class="c-type" data-act="type" data-id="${t.id}"><span class="c-swatch" style="background:${t.swatch}"></span><span><strong>${esc(t.label)}</strong><small>${esc(t.mood)}</small></span></button>`).join('');
    this.$('#c-lang').textContent = typeById(cur).language;
    this._renderEffect();
  }
  _renderEffect() {
    const v = this.vision, type = typeById(v.type);
    const seg = (list, cur, act) => list.map(x => `<button type="button" role="radio" aria-checked="${x.id === cur}" data-act="${act}" data-id="${x.id}">${esc(x.label)}</button>`).join('');
    this.$('#c-tempo').innerHTML = seg(TEMPOS, tempoById(v.tempo).id, 'tempo');
    this.$('#c-intensity').innerHTML = seg(INTENSITIES, v.intensity || 'normal', 'intensity');
    const f = v.filter ?? type.image.filter;
    const fi = this.$('#c-filter');
    if (document.activeElement !== fi) fi.value = String(f);
    this.$('#c-filter-val').textContent = `${Math.round(f * 100)} %${v.filter == null ? ' (Standard)' : ''}`;
  }
  _renderAudio() {
    const files = this.manifest.audio || [];
    const opts = cur => `<option value="">Kein Ton</option>` + files.map(a => `<option value="local-assets/${esc(a.file)}" ${cur === 'local-assets/' + a.file ? 'selected' : ''}>${esc(a.label)}</option>`).join('');
    this.$('#c-bed').innerHTML = opts(this.vision.audio?.bed);
    this.$('#c-heart').innerHTML = opts(this.vision.audio?.heart);
  }

  _renderDetail() {
    const el = this.$('#c-detail'), v = this.vision, type = typeById(v.type), tempo = tempoById(v.tempo);
    if (this.sel === 'intro' || this.sel === 'finale') {
      const key = this.sel, isIntro = key === 'intro';
      const text = v[key]?.text || '';
      el.innerHTML = `<h2>${isIntro ? '01 · Eintauchen' : 'Abschluss'}</h2>
        <p class="c-hint">${isIntro ? 'Dunkelheit, aufziehender Nebel und die ersten Worte, noch bevor ein Bild erscheint.' : 'Das letzte Bild löst sich auf. Dieser Satz bleibt im Raum stehen, bis der Spieler bestätigt.'}</p>
        <label class="c-field c-label">Text<textarea id="c-fixed-text" rows="3" maxlength="300">${esc(text)}</textarea></label>
        <small class="c-count" id="c-fixed-count"></small>`;
      const ta = this.$('#c-fixed-text'), count = () => { this.$('#c-fixed-count').textContent = `${ta.value.length} Zeichen · Lesezeit ${secs(readingMs(ta.value, type, tempo.factor))}`; };
      count();
      ta.addEventListener('input', () => { count(); this.change(vv => { vv[key] = {text: ta.value}; }, {debounce: 250}); });
      return;
    }
    const i = this.sel, m = v.moments[i];
    if (!m) { el.innerHTML = '<p class="c-hint">Wähle links einen Moment.</p>'; return; }
    // nur der Bildbestand dieser Vision; ein Bild außerhalb davon wird als Fremdbild markiert
    const lib = [...(v.images || [])];
    if (!lib.some(x => x.file === m.image)) lib.unshift({file: m.image, label: 'Nicht im Bildbestand dieser Vision'});
    const seg = (list, cur, act) => list.map(x => `<button type="button" role="radio" aria-checked="${x.id === cur}" data-act="${act}" data-id="${x.id}">${esc(x.label)}</button>`).join('');
    el.innerHTML = `<h2>Moment ${String(i + 2).padStart(2, '0')}</h2>
      <label class="c-field c-label">Bezeichnung (nur für dich)<input id="c-m-label" maxlength="60" value="${esc(m.label)}"></label>
      <div class="c-field"><span class="c-label">Wichtigster Bildbereich</span>
        <div class="c-focus" id="c-focus" tabindex="0" role="group" aria-label="Brennpunkt setzen: klicken oder mit den Pfeiltasten verschieben">
          <img src="${esc(m.image)}" alt="" draggable="false"><span class="c-focus-core" id="c-focus-core"></span><span class="c-focus-dot" id="c-focus-dot"></span>
        </div>
        <p class="c-hint">Klicke auf das, was erkennbar bleiben muss. Der Kreis bleibt immer klar sichtbar und nebelfrei, auf jedem Bildschirm.</p>
        <label class="c-inline">Kernbereich <input type="range" id="c-core" min="0.15" max="0.6" step="0.01" value="${m.core ?? 0.36}"></label>
      </div>
      <div class="c-field"><span class="c-label">Größe</span><div class="c-seg" role="radiogroup" aria-label="Größe">${seg(SIZES, m.size || 'mittel', 'size')}</div></div>
      <div class="c-field"><span class="c-label">Platz auf der Bühne</span><div class="c-seg" role="radiogroup" aria-label="Platz">${seg(PLACES, m.place || 'mitte', 'place')}</div>
        <p class="c-hint">Die Worte stehen gegenüber dem Bild. Auf Handys steht das Bild immer oben, die Worte darunter.</p></div>
      <label class="c-field c-label">Text dieses Moments<textarea id="c-m-text" rows="3" maxlength="600">${esc(m.text)}</textarea></label>
      <small class="c-count" id="c-m-count"></small>
      <label class="c-field c-label">Nachhall (bleibt stehen, wenn der Rest verblasst)<input id="c-m-echo" maxlength="60" value="${esc(m.echo)}" placeholder="z. B. ein Wort aus dem Text"></label>
      <small class="c-count" id="c-m-echo-info"></small>
      <label class="c-field c-label">Mindesthaltezeit <span id="c-m-hold-val"></span><input type="range" id="c-m-hold" min="0" max="12000" step="500" value="${m.holdMs || 0}"></label>
      <label class="c-field c-label">Bild<select id="c-m-image">${lib.map(x => `<option value="${esc(x.file)}" ${x.file === m.image ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
      ${this.confirmRemove === i
        ? `<div class="c-confirm" role="group" aria-label="Moment entfernen bestätigen"><span>Diesen Moment entfernen?</span><button type="button" class="c-btn c-btn--danger" data-act="remove-yes" data-i="${i}">Entfernen</button><button type="button" class="c-btn" data-act="remove-no">Behalten</button></div>`
        : `<button type="button" class="c-link c-link--danger" data-act="remove" data-i="${i}">Moment entfernen</button>`}`;
    const upd = (fn, opts) => this.change(vv => fn(vv.moments[i]), opts);
    const count = () => {
      const t = this.$('#c-m-text').value;
      const tl = buildTimeline(this.vision, {reduced: this.player.reduced});
      this.$('#c-m-count').textContent = `${t.length} Zeichen · Lesezeit ${secs(readingMs(t, type, tempo.factor))} · Bild sichtbar ${tl.moments[i] ? secs(tl.moments[i].hold) : '–'}`;
      const e = this.$('#c-m-echo').value.trim();
      this.$('#c-m-echo-info').textContent = !e ? 'Ohne Nachhall verblasst der ganze Satz.' : echoIndices(t, e).length ? 'Steht im Satz: bleibt an seiner Stelle zurück.' : 'Nicht im Satz: erscheint als eigenes Wort nach dem Bild.';
      const h = Number(this.$('#c-m-hold').value);
      this.$('#c-m-hold-val').textContent = h ? secs(h) : 'automatisch';
    };
    count();
    this.$('#c-m-label').addEventListener('input', e => upd(mm => { mm.label = e.target.value; }, {rebuild: false}));
    this.$('#c-m-text').addEventListener('input', e => { upd(mm => { mm.text = e.target.value; }, {debounce: 300}); count(); });
    this.$('#c-m-echo').addEventListener('input', e => { upd(mm => { mm.echo = e.target.value; }, {debounce: 300}); count(); });
    this.$('#c-m-hold').addEventListener('input', e => { upd(mm => { mm.holdMs = Number(e.target.value); }, {debounce: 200}); count(); });
    this.$('#c-m-image').addEventListener('change', e => { upd(mm => { mm.image = e.target.value; }); this._renderDetail(); });
    this.$('#c-core').addEventListener('input', e => { upd(mm => { mm.core = Number(e.target.value); }, {debounce: 40, flow: false}); this._placeFocus(); });
    this._wireFocus(i);
  }
  _placeFocus() {
    const m = this.vision.moments[this.sel], box = this.$('#c-focus');
    if (!m || !box) return;
    const dot = this.$('#c-focus-dot'), core = this.$('#c-focus-core');
    dot.style.left = core.style.left = (m.focus.x * 100) + '%';
    dot.style.top = core.style.top = (m.focus.y * 100) + '%';
    const d = (m.core ?? 0.36) * 2 * box.clientHeight;
    core.style.width = core.style.height = d + 'px';
  }
  _wireFocus(i) {
    const box = this.$('#c-focus');
    const img = box.querySelector('img');
    const set = (x, y) => this.change(v => { v.moments[i].focus = {x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y))}; }, {debounce: 40, flow: false, after: () => this._placeFocus()});
    const fromEvent = e => { const r = box.getBoundingClientRect(); set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); fromEvent(e); });
    box.addEventListener('pointermove', e => { if (box.hasPointerCapture(e.pointerId)) fromEvent(e); });
    box.addEventListener('keydown', e => {
      const f = this.vision.moments[i].focus, step = e.shiftKey ? 0.05 : 0.01;
      const map = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
      if (map[e.key]) { e.preventDefault(); set(f.x + map[e.key][0], f.y + map[e.key][1]); }
    });
    if (img.complete) this._placeFocus(); else img.addEventListener('load', () => this._placeFocus(), {once: true});
  }

  _renderMarks() {
    const tl = this.player.tl;
    if (!tl) return;
    const pct = t => (t / tl.duration) * 100;
    this.$('#c-marks').innerHTML = tl.moments.map(m => `<span class="c-mark-seg" style="left:${pct(m.emergeStart)}%;width:${pct(m.dissolveEnd - m.emergeStart)}%"></span>`).join('')
      + tl.moments.filter(m => m.flashAt !== null).map(m => `<span class="c-mark-flash" style="left:${pct(m.flashAt)}%"></span>`).join('');
  }

  _renderChecks(extra = []) {
    const v = this.vision, type = typeById(v.type), tl = buildTimeline(v, {reduced: this.player?.reduced});
    const items = [];
    const ok = (t) => items.push(['ok', t]), warn = t => items.push(['warn', t]), info = t => items.push(['info', t]);
    if (!v.moments.length) warn('Noch kein Bild. Eine Vision ohne Bild bleibt reine Typografie im Nebel.');
    if (tl.duration > 150000) warn(`Gesamtdauer ${clock(tl.duration)}. Lange Visionen verlieren Spannung; „Weiter“ steht Spielern immer offen.`); else ok(`Gesamtdauer ${clock(tl.duration)} bei Tempo „${tempoById(v.tempo).label}“.`);
    v.moments.forEach((m, i) => {
      const n = String(i + 2).padStart(2, '0');
      if ((m.text || '').length > 220) warn(`Moment ${n}: langer Text (${m.text.length} Zeichen). Lieber kürzen oder auf zwei Momente verteilen.`);
      if (this.player?.dims && !this.player.dims.has(m.image)) warn(`Moment ${n}: Bild nicht geladen.`);
      if (!(v.images || []).some(i => i.file === m.image)) warn(`Moment ${n}: Das Bild gehört nicht zum Bildbestand dieser Vision.`);
      if (m.echo && m.text && !echoIndices(m.text, m.echo).length) info(`Moment ${n}: Nachhall „${m.echo}“ steht nicht im Satz und erscheint als eigenes Wort.`);
    });
    const flashes = tl.moments.filter(m => m.flashAt !== null);
    if (type.flashes) {
      if (tl.reduced) ok('Ruhige Effekte: keine Lichtimpulse, keine Verzerrung, längere Lesezeit.');
      else {
        const gaps = flashes.slice(1).map((m, k) => m.flashAt - flashes[k].flashAt);
        const minGap = gaps.length ? Math.min(...gaps) : Infinity;
        ok(`Lichtimpulse: ${flashes.length}, Abstand mindestens ${Number.isFinite(minGap) ? secs(minGap) : '–'} (Grenze ${secs(FLASH_MIN_GAP_MS)}), kein Stroboskop.`);
      }
    } else ok('Keine Lichtimpulse in diesem Visionstyp.');
    ok('Standbilder bleiben unbewegt. Bewegung entsteht nur durch Nebel, Licht, Partikel und Übergänge.');
    for (const e of extra) items.push(e);
    this.$('#c-checks').innerHTML = items.map(([k, t]) => `<li data-kind="${k}">${esc(t)}</li>`).join('');
  }

  /** Spult zu jedem Text, misst den Kontrast der Worte gegen den tatsächlich gerenderten Hintergrund und springt zurück. */
  async _measureContrast() {
    const p = this.player, tl = p.tl;
    if (!tl) return;
    const wasPlaying = p.playing, t0 = p.t;
    p.pause();
    const results = [];
    for (const x of tl.texts) {
      p.seek(x.inAt + tl.textEnter + 450);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const r of p.measureContrast()) if (r.key === x.key) results.push(r);
    }
    p.seek(t0);
    if (wasPlaying) p.play();
    const worst = results.reduce((a, r) => (a && a.contrastP95 < r.contrastP95 ? a : r), null);
    const extra = [];
    if (!results.length) extra.push(['warn', 'Lesbarkeit: keine Texte gemessen.']);
    else {
      const fails = results.filter(r => r.contrastP95 < 4.5);
      extra.push([fails.length ? 'warn' : 'ok', `Lesbarkeit (${FORMATS[this.format].label}, ${results.length} Texte): schwächster Kontrast ${worst.contrastP95}:1 gegen die hellsten 5 % des Hintergrunds, im Mittel ${worst.contrastMean}:1. Ziel nach WCAG AA: 4,5:1.`]);
      for (const f of fails) extra.push(['warn', `„${f.key}“ unter 4,5:1 (${f.contrastP95}:1). Platz oder Brennpunkt ändern.`]);
    }
    this.lastContrast = results;
    this._renderChecks(extra);
    return results;
  }

  _export() {
    const data = {exportedAt: new Date().toISOString(), vision: this.vision, sceneWhisper: toSceneWhisper(this.vision)};
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    a.download = (this.vision.title || 'vision').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() + '.vision.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async _import(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const v = data.vision || data;
      if (v.format !== 'chroniplay-vision-direction' || !Array.isArray(v.moments)) throw new Error('Kein Visionsablauf');
      this.vision = withPool(v); this.sel = 0; this._persist(); this._renderAll(); void this._boot();
    } catch (e) { alert('Import nicht möglich: ' + (e.message || e)); }
  }
}
