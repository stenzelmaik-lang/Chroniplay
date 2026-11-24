/* Standalone interaction layer. Nothing here calls a server or changes character values.
 * Saving a solve time goes through the optional `services.saveResult` callback of the caller. */
import * as Toys from './toys-core.js';
import * as Moves from './cube-moves.js';
import {createConfetti} from './confetti.js';
import {createDollRenderer} from './doll-3d.js';
import {DOLL_ENTRANCE_SECONDS} from './doll-pose.js';

// Adapted from the standalone playground; all events belong to this mount.
export function mountToys(root, activeToy, personalKey, services = {}) {
  const lifetime = new AbortController();
  let disposed = false, suspended = false;
  const listen = (target, event, callback) => target.addEventListener(event, callback, {signal:lifetime.signal});
  const element = id => root.querySelector('[data-toy-id="' + id + '"]');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  listen(window,'pointerdown',()=>{root.dataset.input='pointer';});
  listen(window,'keydown',()=>{root.dataset.input='keyboard';});
  const reduced = () => media.matches || !!root.closest('.user-reduced-motion');
  const formatNumber = new Intl.NumberFormat('de-DE');
  const storageKey = 'chroniplay:spielpause:' + personalKey;
  const storage = {
    read() {
      try {
        const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return value && typeof value === 'object' ? value : {};
      } catch { return {}; }
    },
    write() {
      try { localStorage.setItem(storageKey, JSON.stringify({ count: doll.count, cubeMode, cubeKeys, cubeMenu })); }
      catch { /* The toys also work when local storage is unavailable. */ }
    }
  };
  const saved = storage.read();
  const initialCount = Number.isSafeInteger(saved.count) && saved.count >= 0 ? saved.count : 0;
  /** 'ebenen': dragging a sticker turns its layer. 'ansicht': dragging only turns the view; turns come from buttons/keys. */
  let cubeMode = saved.cubeMode === 'ansicht' ? 'ansicht' : 'ebenen';
  /** Keyboard turns are optional and off by default, so stray key presses never turn the cube. */
  let cubeKeys = saved.cubeKeys === true;
  let cubeMenu = saved.cubeMenu === true;

  let frameRequest = 0;
  let lastFrame = null;
  let cubeDirty = true, dollDirty = true, spinnerDirty = true;
  let blinkUntil = 0;
  let lastSpinnerLabel = 0;

  function requestFrame() {
    if (!disposed && !suspended && !frameRequest && !document.hidden) frameRequest = requestAnimationFrame(frame);
  }

  function canvasSurface(id) {
    const canvas = element(id);
    const ctx = canvas.getContext('2d');
    const surface = {
      canvas, ctx,
      resize() {
        const bounds = canvas.getBoundingClientRect();
        const density = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.max(1, Math.round(bounds.width * density));
        canvas.height = Math.max(1, Math.round(bounds.height * density));
        cubeDirty = dollDirty = spinnerDirty = true;
        requestFrame();
      },
      clear() {
        ctx.setTransform(canvas.width / 420, 0, 0, canvas.height / 370, 0, 0);
        ctx.clearRect(0, 0, 420, 370);
      },
      point(event) {
        const bounds = canvas.getBoundingClientRect();
        return { x: (event.clientX - bounds.left) * 420 / bounds.width,
          y: (event.clientY - bounds.top) * 370 / bounds.height };
      }
    };
    return surface;
  }

  const cubeSurface = canvasSurface('cube-canvas');
  const dollSurface = canvasSurface('doll-canvas');
  const spinnerSurface = canvasSurface('spinner-canvas');
  let dollRenderer=null;
  if(activeToy==='doll'){
    try { dollRenderer=createDollRenderer(); root.dataset.doll3d='ready'; }
    catch { root.dataset.doll3d='unavailable'; }
  }
  let dollProgress=reduced()?1:0;
  const cube = new Toys.CubeModel();
  const doll = new Toys.SqueezeModel(initialCount);
  const spinner = new Toys.SpinnerModel();
  const view = { yaw: -0.59, pitch: 0.44 };
  const capturedPointers = new Set();
  const history = [];
  const queue = [];
  const timer = new Moves.SolveTimer();
  const confetti = createConfetti(element('cube-confetti'));
  let timerInterval = 0;
  let activeTurn = null;
  let cubePointer = null;
  let cubeDrag = null;
  let cubeRendered = null;
  let userMoves = 0;
  let mixing = false;
  let dollPointer = null;
  let spinnerPointer = null;
  let spinnerAsset = null;
  const initialQuote = 'Massier mich';
  const unavailableQuote='Graf Knautsch kann auf diesem Gerät gerade nicht dargestellt werden.';
  const quotes = [
    'Meine Frisur!', 'Das zählt als Massage.', 'Ich bin aus Plüsch!',
    'Keine Knoblauchfinger, bitte.', 'Ein bisschen würdevoller, ja?',
    'Pffft. Sehr aristokratisch.', 'Die Nacht ist hart. Ich bin weich.',
    'Auch Grafen brauchen eine Pause.'
  ];

  function updateTimerLabel() {
    element('cube-time').textContent = Moves.formatTime(timer.elapsed(performance.now()));
    element('cube-time').dataset.state = timer.state;
  }
  function syncTimerTicker() {
    if (timer.state === 'running' && !timerInterval) timerInterval = setInterval(updateTimerLabel, 50);
    if (timer.state !== 'running' && timerInterval) { clearInterval(timerInterval); timerInterval = 0; }
    updateTimerLabel();
  }

  function updateCubeLabels(message) {
    element('cube-count').textContent = formatNumber.format(userMoves);
    const solved = cube.isSolved();
    const waiting = timer.state === 'armed' ? 'Bereit' : 'Noch ein Dreh';
    element('cube-time').title = timer.state === 'armed' ? 'Die Zeit läuft ab deinem ersten Zug' : '';
    element('cube-state').textContent = message || (solved ? 'Gelöst' : waiting);
    element('cube-state').classList.toggle('is-solved', solved && !mixing);
    const locked = mixing || !!activeTurn || !!cubePointer || queue.length > 0;
    element('cube-mix').disabled = locked;
    element('cube-undo').disabled = locked || history.length === 0;
    for (const button of root.querySelectorAll('[data-move]')) button.disabled = mixing;
    element('cube-history').textContent = history.slice(-7).map(entry => Moves.formatMove(entry.move)).join('  ') || '–';
    element('cube-mode').setAttribute('aria-pressed', String(cubeMode === 'ansicht'));
    element('cube-mode').textContent = cubeMode === 'ansicht' ? 'Ziehen: Ansicht' : 'Ziehen: Ebene drehen';
    root.dataset.cubeMode = cubeMode;
    element('cube-keys').setAttribute('aria-pressed', String(cubeKeys));
    element('cube-keys').textContent = cubeKeys ? 'Tastatur: an' : 'Tastatur: aus';
    element('cube-help').textContent = (cubeMode === 'ansicht' ? 'Ziehen: Ansicht drehen · Drehen über die Knöpfe' : 'Fläche ziehen: Ebene drehen · Daneben ziehen: Ansicht') +
      (cubeKeys ? ' · Tastatur: W oben, S unten, A links, D rechts, Q vorne, E hinten · Umschalt: rückwärts · Strg + A/D/S/E: Mitte · Strg + Z: rückgängig · Pfeile: Ansicht' : '');
    syncTimerTicker();
  }

  /* ----- Personal leaderboard: the caller decides where results live (ChroniPlay server). ----- */
  let leaderboard = [];
  function renderLeaderboard(note) {
    const list = element('cube-ranking-list');
    list.replaceChildren(...leaderboard.slice(0, 10).map((entry, index) => {
      const item = document.createElement('li');
      item.dataset.fresh = String(!!entry.fresh);
      const date = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'}) : '';
      item.innerHTML = '<b></b><span></span><small></small>';
      item.children[0].textContent = (index + 1) + '. ' + Moves.formatTime(entry.timeMs);
      item.children[1].textContent = entry.moves + ' Züge';
      item.children[2].textContent = date;
      return item;
    }));
    element('cube-ranking-note').textContent = note || (leaderboard.length ? 'Nur du siehst deine Bestenliste.' : 'Noch keine gelöste Runde. Mische und leg los!');
  }
  async function loadLeaderboard() {
    if (!services.loadResults) { renderLeaderboard('Bestenliste ist hier nicht verfügbar.'); return; }
    try { leaderboard = (await services.loadResults()).slice().sort(Moves.compareResults); renderLeaderboard(); }
    catch { if (!disposed) renderLeaderboard('Bestenliste gerade nicht erreichbar.'); }
  }
  async function saveResult(result) {
    const best = leaderboard.length === 0 || Moves.compareResults(result, leaderboard[0]) < 0;
    const local = {...result, createdAt: new Date().toISOString(), fresh: true};
    leaderboard = [...leaderboard.map(entry => ({...entry, fresh: false})), local].sort(Moves.compareResults);
    renderLeaderboard();
    if (!services.saveResult) return best;
    try {
      const saved = await services.saveResult({game: 'rubik', ...result});
      if (!disposed && Array.isArray(saved)) {
        leaderboard = saved.map(entry => ({...entry, fresh: entry.timeMs === result.timeMs && entry.moves === result.moves})).sort(Moves.compareResults);
        renderLeaderboard();
      }
    } catch { if (!disposed) renderLeaderboard('Zeit konnte nicht gespeichert werden. Sie steht nur hier.'); }
    return best;
  }

  function celebrate(result) {
    const best = leaderboard.length === 0 || Moves.compareResults(result, leaderboard[0]) < 0;
    element('cube-win-time').textContent = Moves.formatTime(result.timeMs);
    element('cube-win-moves').textContent = formatNumber.format(result.moves) + ' Züge';
    element('cube-win-best').hidden = !best;
    element('cube-win').hidden = false;
    root.dataset.cubeSolved = 'true';
    if (!reduced()) confetti.burst();
    saveResult(result);
  }
  function hideCelebration() {
    element('cube-win').hidden = true;
    delete root.dataset.cubeSolved;
    confetti.stop();
  }

  function startRound() {
    if (entrance || activeTurn || cubePointer || queue.length) return;
    hideCelebration();
    userMoves = 0; history.length = 0;
    timer.cancel(); timer.reset();
    // Every round scrambles a solved cube, so the shown scramble fully describes the start position.
    cube.reset(); cubeDirty = true;
    mixing = true;
    queueScramble();
    updateCubeLabels('Wird gemischt …'); requestFrame();
  }
  /** The scramble is kept as notation on the toy (data-scramble) so a round can be checked and replayed. */
  function queueScramble() {
    const moves = Moves.scramble();
    root.dataset.scramble = Moves.formatSequence(moves);
    for (const move of moves) queue.push({ move, kind: 'mix' });
  }

  function enqueueMove(move, kind = 'user') {
    if (cubePointer || mixing && kind !== 'mix' || queue.length > 30) return;
    if (entrance && kind !== 'mix') return;
    queue.push({ move: { ...move }, kind });
    cubeDirty = true;
    updateCubeLabels(mixing ? 'Wird gemischt …' : '');
    requestFrame();
  }

  function finishTurn(turn) {
    let result = null;
    if (turn.move.quarter !== 0) {
      cube.apply(turn.move);
      if (turn.kind !== 'undo') history.push({ move: { ...turn.move }, kind: turn.kind });
      const now = performance.now();
      if (turn.kind === 'user') { userMoves++; timer.countMove(now); }
      if (turn.kind === 'undo') timer.countUndo(now);
      if (turn.kind !== 'mix' && cube.isSolved()) result = timer.solved(now);
    }
    activeTurn = null;
    if (queue.length === 0) {
      const wasMixing = mixing;
      mixing = false;
      // The clock is armed only after a real scramble; it then waits for the first own turn.
      if (wasMixing && !cube.isSolved()) { history.length = 0; timer.arm(); }
      if (!entrance) ready();
    }
    if (result) celebrate(result);
    updateCubeLabels(mixing ? 'Wird gemischt …' : '');
    cubeDirty = true;
  }

  function advanceCube(dt) {
    // Instant turns under reduced motion use the exact same cubie operations.
    let completions = 0;
    while (completions < 32) {
      if (!activeTurn && queue.length > 0) {
        const next = queue.shift();
        activeTurn = { ...next, elapsed: 0, from: 0,
          to: next.move.quarter * Math.PI / 2,
          duration: reduced() ? 0 : next.kind === 'mix' ? 0.068 : 0.19, angle: 0 };
      }
      if (!activeTurn) return;
      activeTurn.elapsed += dt;
      const progress = activeTurn.duration === 0 ? 1 : Math.min(1, activeTurn.elapsed / activeTurn.duration);
      const easing = 1 - Math.pow(1 - progress, 3);
      activeTurn.angle = activeTurn.from + (activeTurn.to - activeTurn.from) * easing;
      cubeDirty = true;
      if (progress < 1) return;
      finishTurn(activeTurn);
      completions++;
      if (!reduced()) return;
    }
  }

  // Twelve basic turns (U, U′ … B′) plus the middle slices, all through the same notation.
  for (const button of root.querySelectorAll('[data-move]')) {
    const move = Moves.parseMove(button.dataset.move);
    const [face, prime] = [button.dataset.move[0], button.dataset.move.length > 1];
    button.setAttribute('aria-label', Moves.FACE_NAMES[face] + (prime ? ' gegen den Uhrzeigersinn' : ' im Uhrzeigersinn') + ' drehen (' + button.dataset.move + ')');
    const keyHint = {U:'W', D:'S', L:'A', R:'D', F:'Q', B:'E'}[face];
    button.title = button.getAttribute('aria-label') + (keyHint ? ' · Taste ' + (prime ? 'Umschalt + ' : '') + keyHint : '');
    listen(button, 'click', () => enqueueMove(move));
  }
  listen(element('cube-mix'), 'click', startRound);
  listen(element('cube-again'), 'click', startRound);
  listen(element('cube-undo'), 'click', () => {
    if (activeTurn || cubePointer || queue.length || !history.length) return;
    const previous = history.pop();
    if (previous.kind === 'user') userMoves++;
    enqueueMove(Moves.invertMove(previous.move), 'undo');
  });
  listen(element('cube-reset'), 'click', () => {
    queue.length = history.length = 0;
    activeTurn = cubeDrag = cubePointer = null;
    mixing = false; userMoves = 0; cube.reset(); timer.cancel(); hideCelebration();
    view.yaw = -0.59; view.pitch = 0.44;
    root.dataset.phase = 'ready';
    cubeDirty = true; updateCubeLabels(); requestFrame();
  });
  listen(element('cube-mode'), 'click', () => {
    cubeMode = cubeMode === 'ansicht' ? 'ebenen' : 'ansicht';
    storage.write(); updateCubeLabels();
  });
  listen(element('cube-keys'), 'click', () => {
    cubeKeys = !cubeKeys;
    storage.write(); updateCubeLabels();
  });
  function showRanking(visible) {
    element('cube-ranking').hidden = !visible;
    element('cube-ranking-toggle').setAttribute('aria-expanded', String(visible));
    if (visible) loadLeaderboard();
  }
  listen(element('cube-ranking-toggle'), 'click', () => showRanking(element('cube-ranking').hidden));
  // The bottom menu is optional: hidden by default (mouse play), remembered per player.
  function showMenu(visible) {
    cubeMenu = visible;
    element('cube-menu').hidden = !visible;
    element('cube-menu-toggle').setAttribute('aria-expanded', String(visible));
    storage.write();
  }
  listen(element('cube-menu-toggle'), 'click', () => showMenu(element('cube-menu').hidden));
  listen(element('cube-menu-close'), 'click', () => { showMenu(false); element('cube-menu-toggle').focus(); });
  showMenu(cubeMenu);
  listen(element('cube-ranking-close'), 'click', () => { showRanking(false); element('cube-ranking-toggle').focus(); });
  listen(element('cube-win-close'), 'click', hideCelebration);
  listen(element('cube-view'), 'click', () => {
    view.yaw = -0.59; view.pitch = 0.44;
    cubeDirty = true; requestFrame();
  });

  listen(cubeSurface.canvas, 'contextmenu', event => event.preventDefault());
  listen(cubeSurface.canvas, 'pointerdown', event => {
    if (entrance) return;
    if (!event.isPrimary || activeTurn || queue.length || cubePointer) return;
    if (![0, 1, 2].includes(event.button)) return;
    event.preventDefault();
    cubeSurface.canvas.focus({ preventScroll: true });
    const point = cubeSurface.point(event);
    const turnsLayers = cubeMode === 'ebenen' && event.button === 0 && !event.altKey && !mixing;
    const hit = turnsLayers && cubeRendered ? Toys.pickCube(cubeRendered, point) : null;
    cubePointer = { id: event.pointerId, point, hit, moved: false, yaw: view.yaw, pitch: view.pitch, samples: [] };
    capturedPointers.add(event.pointerId); cubeSurface.canvas.setPointerCapture(event.pointerId);
    updateCubeLabels();
  });
  listen(cubeSurface.canvas, 'pointermove', event => {
    if (!cubePointer || cubePointer.id !== event.pointerId) return;
    const point = cubeSurface.point(event);
    const dx = point.x - cubePointer.point.x, dy = point.y - cubePointer.point.y;
    const travelled = Math.hypot(dx, dy);
    if (travelled < Moves.DRAG_START && !cubePointer.moved) return;
    cubePointer.moved = true;
    if (!cubePointer.hit) {
      view.yaw = cubePointer.yaw + dx * 0.009;
      view.pitch = Toys.clamp(cubePointer.pitch + dy * 0.009, -1.2, 1.2);
    } else {
      if (!cubeDrag) {
        // Lock one direction only when it is clearly dominant; diagonal wobble turns nothing.
        const candidates = Toys.swipeCandidates(cubePointer.hit, cubeRendered.camera)
          .map(candidate => ({ ...candidate, score: Math.abs(candidate.unit[0] * dx + candidate.unit[1] * dy) / travelled }));
        const chosen = Moves.chooseSwipe(candidates, travelled);
        if (!chosen) return;
        cubeDrag = { ...chosen, angle: 0, origin: { x: dx, y: dy } };
      }
      const distance = dx * cubeDrag.unit[0] + dy * cubeDrag.unit[1];
      cubeDrag.angle = Toys.clamp(distance * (Math.PI / 2) / Moves.DRAG_QUARTER, -Math.PI * 0.55, Math.PI * 0.55);
      const now = performance.now();
      cubePointer.samples.push({ t: now, angle: cubeDrag.angle });
      while (cubePointer.samples.length > 2 && now - cubePointer.samples[0].t > 90) cubePointer.samples.shift();
    }
    cubeDirty = true; requestFrame();
  });

  function endCubePointer(event, cancelled = false) {
    if (!cubePointer || cubePointer.id !== event.pointerId) return;
    if (cubeDrag) {
      const samples = cubePointer.samples || [], first = samples[0], last = samples[samples.length - 1];
      const velocity = first && last && last.t > first.t ? (last.angle - first.angle) / ((last.t - first.t) / 1000) : 0;
      const quarter = cancelled ? 0 : Moves.releaseQuarter(cubeDrag.angle, velocity);
      activeTurn = {
        move: { axis: cubeDrag.axis, layer: cubeDrag.layer, quarter },
        kind: 'user', from: cubeDrag.angle, to: quarter * Math.PI / 2,
        angle: cubeDrag.angle, elapsed: 0, duration: reduced() ? 0 : 0.16
      };
    }
    cubePointer = cubeDrag = null;
    cubeDirty = true; updateCubeLabels(); requestFrame();
  }
  listen(cubeSurface.canvas, 'pointerup', event => endCubePointer(event));
  listen(cubeSurface.canvas, 'pointercancel', event => endCubePointer(event, true));
  listen(cubeSurface.canvas, 'lostpointercapture', event => endCubePointer(event, true));
  // Gamer layout around WASD: W top, S bottom, A left, D right, Q front, E back. Shift turns backwards (′).
  // Ctrl turns the middle slice on the same side: Ctrl+A = M, Ctrl+D = M′, Ctrl+S = E, Ctrl+E = S′ (Shift reverses).
  // Ctrl+W and Ctrl+Q stay with the browser (close tab / quit) and cannot be used by a page.
  // Ctrl+Z undoes, arrow keys turn the view so the hidden sides can be inspected.
  const keyboardFaces = { w: 'U', s: 'D', a: 'L', d: 'R', q: 'F', e: 'B' };
  const keyboardSlices = { a: 'M', d: 'M′', s: 'E', e: 'S′' };
  const keyboardView = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] };
  const invertNotation = name => name.endsWith('′') ? name.slice(0, -1) : name + '′';
  listen(element('rubikwuerfel'), 'keydown', event => {
    if (!cubeKeys || event.altKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])')) return;
    const letter = event.key.length === 1 ? event.key.toLowerCase() : '';
    if (event.ctrlKey) {
      if (letter === 'z') {
        event.preventDefault(); event.stopPropagation();
        if (!event.repeat && !entrance) element('cube-undo').click();
        return;
      }
      const slice = keyboardSlices[letter];
      if (!slice) return;
      event.preventDefault(); event.stopPropagation();
      if (event.repeat || entrance) return;
      enqueueMove(Moves.parseMove(event.shiftKey ? invertNotation(slice) : slice));
      return;
    }
    if (keyboardView[event.key]) {
      event.preventDefault(); event.stopPropagation();
      if (entrance) return;
      view.yaw += keyboardView[event.key][0];
      view.pitch = Toys.clamp(view.pitch + keyboardView[event.key][1], -1.2, 1.2);
      cubeDirty = true; requestFrame();
      return;
    }
    if (event.repeat) return;
    const face = keyboardFaces[letter];
    if (!face) return;
    event.preventDefault(); event.stopPropagation();
    if (entrance) return;
    enqueueMove(Moves.parseMove(face + (event.shiftKey ? '′' : '')));
  });

  function updateDollLabels() {
    element('doll-count').textContent = formatNumber.format(doll.count);
    dollSurface.canvas.setAttribute('aria-label', 'Graf Knautsch quetschen. Bisher ' + doll.count + ' Quetscher.');
    dollSurface.canvas.setAttribute('aria-pressed', String(doll.held));
    element('doll-state').textContent = doll.held ? 'Wird gequetscht' : 'Zum Quetschen bereit';
  }
  function pressDoll() {
    if (entrance || !dollRenderer) return;

    if (!doll.press()) return;
    updateDollLabels(); storage.write();
    element('doll-quote').textContent = quotes[(doll.count - 1) % quotes.length];
    if (!reduced()) element('doll-speech').animate?.([
      { transform: 'translateX(-50%) scale(0.94)' },
      { transform: 'translateX(-50%) scale(1.025)', offset: 0.65 },
      { transform: 'translateX(-50%) scale(1)' }
    ], { duration: 190, easing: 'ease-out' });
    dollDirty = true; requestFrame();
  }
  function releaseDoll() {
    doll.release(); updateDollLabels(); dollDirty = true; requestFrame();
  }
  listen(dollSurface.canvas, 'pointerdown', event => {
    if (entrance) return;
    if (!event.isPrimary || event.button !== 0 || dollPointer !== null) return;
    event.preventDefault();
    dollPointer = event.pointerId;
    dollSurface.canvas.focus({ preventScroll: true });
    capturedPointers.add(event.pointerId); dollSurface.canvas.setPointerCapture(event.pointerId);
    pressDoll();
  });
  function endDollPointer(event) {
    if (event.pointerId !== dollPointer) return;
    dollPointer = null; releaseDoll();
  }
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(dollSurface.canvas, eventName, endDollPointer);
  }
  listen(dollSurface.canvas, 'pointermove', event => {
    const point = dollSurface.point(event);
    if (doll.held) doll.wobbleVelocity += (point.x - 210) * 0.0008;
    dollDirty = true; requestFrame();
  });
  listen(dollSurface.canvas, 'keydown', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault(); if (!event.repeat) pressDoll();
  });
  listen(dollSurface.canvas, 'keyup', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault(); releaseDoll();
  });
  listen(dollSurface.canvas, 'blur', releaseDoll);
  listen(dollSurface.canvas, 'click', event => {
    // Assistive technology activates a button with a click instead of a pointer gesture.
    if (event.detail === 0) { pressDoll(); releaseDoll(); }
  });
  listen(element('doll-reset'), 'click', () => {
    doll.count = 0; updateDollLabels(); storage.write();
    element('doll-quote').textContent = initialQuote;
  });

  function updateSpinnerLabels() {
    element('spinner-speed').textContent = formatNumber.format(Math.round(Math.abs(spinner.speed) * 60 / Toys.TAU));
    element('spinner-turns').textContent = formatNumber.format(Math.floor(spinner.turns));
    element('spinner-stop').disabled = Math.abs(spinner.speed) < 0.035 && !spinner.dragging;
  }
  function nudgeSpinner(direction = 1) {
    if (entrance) return;
    spinner.impulse(direction);
    spinnerDirty = true; updateSpinnerLabels(); requestFrame();
  }
  listen(element('spinner-push'), 'click', () => nudgeSpinner(spinner.speed < 0 ? -1 : 1));
  listen(element('spinner-stop'), 'click', () => {
    spinner.stop(); spinnerDirty = true; updateSpinnerLabels(); requestFrame();
  });
  listen(spinnerSurface.canvas, 'pointerdown', event => {
    if (entrance) return;
    if (!event.isPrimary || event.button !== 0 || spinnerPointer) return;
    event.preventDefault();
    spinnerSurface.canvas.focus({ preventScroll: true });
    const point = spinnerSurface.point(event);
    const x = point.x - 210, y = (point.y - 370 * 0.47) / 0.96;
    spinnerPointer = { id: event.pointerId, x: point.x, y: point.y,
      angle: Math.atan2(y, x), lastTime: performance.now(), moved: false, radius: Math.hypot(x, y) };
    spinner.dragging = spinnerPointer.radius >= 24;
    capturedPointers.add(event.pointerId); spinnerSurface.canvas.setPointerCapture(event.pointerId);
    spinnerDirty = true; updateSpinnerLabels(); requestFrame();
  });
  listen(spinnerSurface.canvas, 'pointermove', event => {
    if (!spinnerPointer || spinnerPointer.id !== event.pointerId) return;
    const point = spinnerSurface.point(event);
    if (Math.hypot(point.x - spinnerPointer.x, point.y - spinnerPointer.y) < 5 && !spinnerPointer.moved) return;
    if (spinnerPointer.radius < 24 && !spinnerPointer.moved) return;
    spinnerPointer.moved = true;
    const angle = Math.atan2((point.y - 370 * 0.47) / 0.96, point.x - 210);
    const now = performance.now();
    spinner.drag(Toys.angleDifference(angle, spinnerPointer.angle), (now - spinnerPointer.lastTime) / 1000);
    spinnerPointer.angle = angle; spinnerPointer.lastTime = now;
    spinnerDirty = true; updateSpinnerLabels(); requestFrame();
  });
  function endSpinnerPointer(event, cancelled = false) {
    if (!spinnerPointer || spinnerPointer.id !== event.pointerId) return;
    const was = spinnerPointer;
    spinnerPointer = null; spinner.dragging = false;
    if (cancelled) spinner.stop();
    else if (!was.moved) nudgeSpinner(spinner.speed < 0 ? -1 : 1);
    else if (performance.now() - was.lastTime > 160) spinner.stop();
    spinnerDirty = true; updateSpinnerLabels(); requestFrame();
  }
  listen(spinnerSurface.canvas, 'pointerup', event => endSpinnerPointer(event));
  listen(spinnerSurface.canvas, 'pointercancel', event => endSpinnerPointer(event, true));
  listen(spinnerSurface.canvas, 'lostpointercapture', event => endSpinnerPointer(event, true));
  listen(spinnerSurface.canvas, 'keydown', event => {
    if (event.repeat || ![' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      spinner.stop(); updateSpinnerLabels(); spinnerDirty = true; requestFrame();
    } else nudgeSpinner(event.key === 'ArrowLeft' ? -1 : 1);
  });
  listen(spinnerSurface.canvas, 'click', event => {
    if (event.detail === 0) nudgeSpinner(spinner.speed < 0 ? -1 : 1);
  });

  const motion = root.querySelector('[data-toy-motion="' + activeToy + '"]');
  const controls = root.querySelector('[data-toy-controls="' + activeToy + '"]');
  let entrance = reduced() || activeToy==='doll'&&!dollRenderer ? null : {elapsed:0,duration:activeToy === 'cube' ? 0.72 : activeToy === 'doll' ? DOLL_ENTRANCE_SECONDS : 2.8};
  function ready() {
    root.dataset.phase = 'ready'; controls.disabled = false;
    if (activeToy === 'doll') element('doll-quote').textContent = dollRenderer?initialQuote:unavailableQuote;
  }
  function arrive() {
    motion.style.transform = '';
    dollProgress=1;
    entrance = null;
    if (activeToy === 'cube') {
      mixing = true; root.dataset.phase = 'mixing'; controls.disabled = true;
      queueScramble();
      updateCubeLabels('Wird magisch gemischt …');
    } else { if (activeToy === 'spinner') spinner.stop(); ready(); }
  }
  function advanceEntrance(dt) {
    if (!entrance) return;
    entrance.elapsed += dt;
    const t = reduced() ? 1 : Math.min(1,entrance.elapsed / entrance.duration);
    if (activeToy === 'cube') {
      const fall = t < 0.72 ? (1 - (t / 0.72) ** 2) : -Math.sin((t-0.72)/0.28*Math.PI)*0.055;
      motion.style.transform = 'translateY(' + (-root.clientHeight * 0.75 * fall) + 'px)';
    } else if (activeToy === 'doll') {
      dollProgress=t;dollDirty=true;
    } else {
      const box = motion.getBoundingClientRect();
      const rx = Math.max(0,(root.clientWidth-box.width)/2-12);
      const ry = Math.max(0,Math.min(root.clientHeight*0.15,motion.offsetTop-12,root.clientHeight-motion.offsetTop-motion.offsetHeight-12));
      const decay = (1-t);
      motion.style.transform = 'translate('+Math.sin(t*Math.PI*6)*rx*decay+'px,'+Math.cos(t*Math.PI*5)*ry*decay+'px)';
      spinner.angle += (1-t)*dt*48; spinnerDirty = true;
    }
    if (t === 1) arrive();
  }
  root.dataset.phase = entrance ? 'entrance' : 'ready';
  controls.disabled = !!entrance;
  if (!entrance) { if (activeToy === 'cube') arrive(); else ready(); }

  // Existing dialogs and presentations take priority without discarding personal state.
  function syncPriority() {
    const dialogOpen = [...document.querySelectorAll('dialog[open], [role="dialog"]')]
      .some(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
    const next = root.dataset.blocked === 'true' || dialogOpen;
    if (next === suspended) return;
    suspended = next; root.dataset.suspended = String(next); root.inert = next;
    if (next) { releaseInputs(); cancelAnimationFrame(frameRequest); frameRequest = 0; }
    else { lastFrame = null; requestFrame(); }
  }
  const priorityObserver = new MutationObserver(syncPriority);
  priorityObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','data-state','data-blocked','class']});
  syncPriority();

  function frame(timestamp) {
    frameRequest = 0;
    if (disposed || suspended) return;
    const dt = lastFrame === null ? 1 / 60 : Math.min((timestamp - lastFrame) / 1000, 0.04);
    lastFrame = timestamp;
    advanceEntrance(dt);
    advanceCube(dt);
    const dollMoving = doll.held || Math.abs(doll.value) > 0.0005 || Math.abs(doll.velocity) > 0.005 || Math.abs(doll.wobbleVelocity) > 0.001;
    if (dollMoving) { doll.step(dt, reduced()); dollDirty = true; }
    else if (doll.value !== 0 || doll.wobble !== 0) {
      doll.value = doll.velocity = doll.wobble = doll.wobbleVelocity = 0;
      dollDirty = true;
    }
    if (Math.abs(spinner.speed) > 0) {
      spinner.step(dt); spinnerDirty = true;
    }
    if (cubeDirty && activeToy === 'cube') {
      cubeSurface.clear();
      const rotating = cubeDrag || (activeTurn && { ...activeTurn.move, angle: activeTurn.angle });
      cubeRendered = Toys.drawCube(cubeSurface.ctx, cube, { ...view, rotation: rotating });
      cubeDirty = false;
    }
    if (activeToy === 'doll' && (dollDirty || timestamp < blinkUntil)) {
      dollSurface.clear();
      dollRenderer?.draw(dollSurface.ctx,{progress:dollProgress,squeeze:doll.value,wobble:doll.wobble});
      dollDirty = false;
    }
    if (spinnerDirty && activeToy === 'spinner') {
      spinnerSurface.clear(); Toys.drawSpinner(spinnerSurface.ctx, {...spinner, asset:spinnerAsset}); spinnerDirty = false;
    }
    if (timestamp - lastSpinnerLabel > 120) { updateSpinnerLabels(); lastSpinnerLabel = timestamp; }
    if (entrance || activeTurn || queue.length || dollMoving || spinner.speed !== 0 || timestamp < blinkUntil) requestFrame();
    else { lastFrame = null; updateSpinnerLabels(); }
  }

  function releaseInputs() {
    if (cubePointer) endCubePointer({ pointerId: cubePointer.id }, true);
    dollPointer = null; releaseDoll();
    if (spinnerPointer) {
      spinnerPointer = null; spinner.dragging = false; spinner.stop();
      spinnerDirty = true; updateSpinnerLabels();
    }
  }
  listen(window, 'blur', releaseInputs);
  listen(document, 'visibilitychange', () => {
    lastFrame = null;
    if (document.hidden) {
      releaseInputs();
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    } else requestFrame();
  });
  const surfaces = [cubeSurface, dollSurface, spinnerSurface];
  let observer;
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(entries => {
      for (const entry of entries) surfaces.find(surface => surface.canvas === entry.target)?.resize();
    });
    for (const surface of surfaces) observer.observe(surface.canvas);
  } else listen(window, 'resize', () => surfaces.forEach(surface => surface.resize()));
  listen(media, 'change', () => { cubeDirty = dollDirty = spinnerDirty = true; requestFrame(); });
  const puppetImage = new Image();
  listen(puppetImage, 'load', () => {
    dollRenderer?.setImage(puppetImage);
    dollDirty = true; requestFrame();
  });
  if (activeToy === 'doll') puppetImage.src = '/spielpause/graf-knautsch.webp';
  const spinnerImage = new Image();
  listen(spinnerImage,'load',() => { spinnerAsset = spinnerImage; spinnerDirty = true; requestFrame(); });
  if (activeToy === 'spinner') spinnerImage.src = '/spielpause/vampir-spinner.webp';
  element('doll-quote').textContent = activeToy==='doll'&&!dollRenderer?unavailableQuote:initialQuote;
  updateCubeLabels(); updateDollLabels(); updateSpinnerLabels();
  if (activeToy === 'cube') loadLeaderboard();
  for (const surface of surfaces) surface.resize();
  requestFrame();
  return () => {
    disposed = true;
    if (timerInterval) clearInterval(timerInterval);
    confetti.stop();
    dollRenderer?.dispose();
    lifetime.abort(); observer?.disconnect(); priorityObserver.disconnect();
    cancelAnimationFrame(frameRequest);
    releaseInputs();
    root.getAnimations({subtree:true}).forEach(animation => animation.cancel());
    for (const canvas of [cubeSurface.canvas,dollSurface.canvas,spinnerSurface.canvas]) {
      for (const id of capturedPointers) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
  };
}
