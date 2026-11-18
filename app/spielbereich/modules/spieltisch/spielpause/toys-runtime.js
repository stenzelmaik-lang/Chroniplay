/* Standalone interaction layer. Nothing here calls a server or changes character values. */
import * as Toys from './toys-core.js';
import {createDollRenderer} from './doll-3d.js';
import {DOLL_ENTRANCE_SECONDS} from './doll-pose.js';

// Adapted from the standalone playground; all events belong to this mount.
export function mountToys(root, activeToy, personalKey) {
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
      try { localStorage.setItem(storageKey, JSON.stringify({ count: doll.count })); }
      catch { /* The toys also work when local storage is unavailable. */ }
    }
  };
  const saved = storage.read();
  const initialCount = Number.isSafeInteger(saved.count) && saved.count >= 0 ? saved.count : 0;

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
  let selectedFace = 'F';
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

  function updateCubeLabels(message) {
    element('cube-count').textContent = formatNumber.format(userMoves);
    const solved = cube.isSolved();
    element('cube-state').textContent = message || (solved ? 'Gelöst' : 'Noch ein Dreh');
    element('cube-state').classList.toggle('is-solved', solved && !mixing);
    const locked = mixing || !!activeTurn || !!cubePointer || queue.length > 0;
    element('cube-mix').disabled = locked;
    element('cube-undo').disabled = locked || history.length === 0;
    element('cube-cw').disabled = mixing;
    element('cube-ccw').disabled = mixing;
    element('cube-history').textContent = history.slice(-7).map(entry => Toys.moveLabel(entry.move)).join('  ') || '–';
  }

  function selectFace(face) {
    selectedFace = face;
    for (const button of root.querySelectorAll('[data-face]')) {
      button.setAttribute('aria-pressed', String(button.dataset.face === face));
    }
    const label = root.querySelector('[data-face="' + face + '"]').textContent.trim();
    element('cube-cw').setAttribute('aria-label', label + ' im Uhrzeigersinn drehen');
    element('cube-ccw').setAttribute('aria-label', label + ' gegen den Uhrzeigersinn drehen');
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
    if (turn.move.quarter !== 0) {
      cube.apply(turn.move);
      if (turn.kind !== 'undo') history.push({ move: { ...turn.move }, kind: turn.kind });
      if (turn.kind === 'user') userMoves++;

    }
    activeTurn = null;
    if (queue.length === 0) { mixing = false; if (!entrance) ready(); }
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

  for (const button of root.querySelectorAll('[data-face]')) {
    listen(button, 'click', () => selectFace(button.dataset.face));
  }
  for (const [id, direction] of [['cube-cw', 1], ['cube-ccw', -1]]) {
    element(id).addEventListener('click', () => {

      const move = Toys.FACE_MOVES[selectedFace];
      enqueueMove({ ...move, quarter: move.quarter * direction });
    });
  }
  listen(element('cube-mix'), 'click', () => {
    if (activeTurn || cubePointer || queue.length) return;

    userMoves = 0;
    mixing = true;
    for (const move of Toys.scrambleMoves()) queue.push({ move, kind: 'mix' });
    updateCubeLabels('Wird gemischt …'); requestFrame();
  });
  listen(element('cube-undo'), 'click', () => {
    if (activeTurn || cubePointer || queue.length || !history.length) return;

    const previous = history.pop();
    if (previous.kind === 'user') userMoves = Math.max(0, userMoves - 1);
    enqueueMove(Toys.inverseMove(previous.move), 'undo');
  });
  listen(element('cube-reset'), 'click', () => {
    queue.length = history.length = 0;
    activeTurn = cubeDrag = cubePointer = null;
    mixing = false; userMoves = 0; cube.reset();
    view.yaw = -0.59; view.pitch = 0.44;
    root.dataset.phase = 'ready';
    selectFace('F'); cubeDirty = true; updateCubeLabels(); requestFrame();
  });
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
    const hit = event.button === 0 && !event.altKey && cubeRendered ? Toys.pickCube(cubeRendered, point) : null;
    cubePointer = { id: event.pointerId, point, hit, moved: false, yaw: view.yaw, pitch: view.pitch };
    capturedPointers.add(event.pointerId); cubeSurface.canvas.setPointerCapture(event.pointerId);
    updateCubeLabels();
  });
  listen(cubeSurface.canvas, 'pointermove', event => {
    if (!cubePointer || cubePointer.id !== event.pointerId) return;
    const point = cubeSurface.point(event);
    const dx = point.x - cubePointer.point.x, dy = point.y - cubePointer.point.y;
    if (Math.hypot(dx, dy) < 9 && !cubePointer.moved) return;
    cubePointer.moved = true;
    if (!cubePointer.hit) {
      view.yaw = cubePointer.yaw + dx * 0.009;
      view.pitch = Toys.clamp(cubePointer.pitch + dy * 0.009, -1.2, 1.2);
    } else {
      if (!cubeDrag) {
        const candidate = Toys.swipeMove(cubePointer.hit, { x: dx, y: dy }, cubeRendered.camera);
        if (!candidate) return;
        cubeDrag = { ...candidate, angle: 0 };
      }
      const distance = dx * cubeDrag.unit[0] + dy * cubeDrag.unit[1];
      cubeDrag.angle = Toys.clamp(distance * Math.PI / 160, -Math.PI * 0.62, Math.PI * 0.62);
    }
    cubeDirty = true; requestFrame();
  });

  function endCubePointer(event, cancelled = false) {
    if (!cubePointer || cubePointer.id !== event.pointerId) return;
    if (cubeDrag) {
      const quarter = !cancelled && Math.abs(cubeDrag.angle) > 0.2 ? Math.sign(cubeDrag.angle) : 0;
      activeTurn = {
        move: { axis: cubeDrag.axis, layer: cubeDrag.layer, quarter },
        kind: 'user', from: cubeDrag.angle, to: quarter * Math.PI / 2,
        angle: cubeDrag.angle, elapsed: 0, duration: reduced() ? 0 : 0.16
      };
    } else if (!cancelled && !cubePointer.moved && cubePointer.hit) {
      selectFace(Toys.faceFromNormal(cubePointer.hit.normal));
    }
    cubePointer = cubeDrag = null;
    cubeDirty = true; updateCubeLabels(); requestFrame();
  }
  listen(cubeSurface.canvas, 'pointerup', event => endCubePointer(event));
  listen(cubeSurface.canvas, 'pointercancel', event => endCubePointer(event, true));
  listen(cubeSurface.canvas, 'lostpointercapture', event => endCubePointer(event, true));
  const keyboardFaces = {
    ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
    w: 'U', a: 'L', s: 'D', d: 'R', q: 'F', e: 'B',
    u: 'U', l: 'L', r: 'R', f: 'F', b: 'B', m: 'M'
  };
  listen(element('rubikwuerfel'), 'keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const face = keyboardFaces[key];
    if (!face) return;
    event.preventDefault(); event.stopPropagation();
    if (entrance) return;
    const base = Toys.FACE_MOVES[face];
    if (['U', 'D', 'L', 'R', 'F', 'B'].includes(face)) selectFace(face);
    enqueueMove({ ...base, quarter: base.quarter * (event.shiftKey ? -1 : 1) });
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
      for (const move of Toys.scrambleMoves()) queue.push({move,kind:'mix'});
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
  selectFace('F'); updateCubeLabels(); updateDollLabels(); updateSpinnerLabels();
  for (const surface of surfaces) surface.resize();
  requestFrame();
  return () => {
    disposed = true;
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
