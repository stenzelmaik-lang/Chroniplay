/* Spielpause: read-only view of another player's Rubik cube (only after their invitation).
 * The viewer can turn the view, never the cube. The state comes from the host's feed: all turns of the round
 * from the solved start. New turns of the same round are animated; anything else is rebuilt at once. */
import * as Toys from './toys-core.js';
import * as Moves from './cube-moves.js';

/** What the viewer must do to show `feed`, given what it shows now. Pure, so it is tested without a browser. */
export function feedDelta(shownRound, shownMoves, feed) {
  const moves = feed.moves ? feed.moves.split(' ') : [];
  const sameRound = shownRound === feed.round && moves.length >= shownMoves.length && shownMoves.every((m, i) => moves[i] === m);
  return sameRound ? {reset: false, moves, append: moves.slice(shownMoves.length)} : {reset: true, moves, append: []};
}

/** Viewer's clock: the host's elapsed time plus the age of the feed and the time since it arrived here. */
export function watchElapsed(feed, ageMs, receivedAt, now) {
  if (!feed) return 0;
  return feed.timerState === 'running' ? feed.timeMs + (ageMs || 0) + Math.max(0, now - receivedAt) : feed.timeMs;
}

export function mountWatch(root) {
  const lifetime = new AbortController();
  const listen = (target, event, callback) => target.addEventListener(event, callback, {signal: lifetime.signal});
  const element = id => root.querySelector('[data-watch-id="' + id + '"]');
  const canvas = element('canvas'), ctx = canvas.getContext('2d');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !!root.closest('.user-reduced-motion');
  const formatNumber = new Intl.NumberFormat('de-DE');
  const cube = new Toys.CubeModel();
  const view = {yaw: -0.59, pitch: 0.44};
  const queue = [];
  let shownRound = null, shownMoves = [], active = null, frameRequest = 0, lastFrame = null, disposed = false;
  let feed = null, ageMs = 0, receivedAt = 0, clock = 0, drag = null;

  function resize() {
    const bounds = canvas.getBoundingClientRect(), density = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(bounds.width * density));
    canvas.height = Math.max(1, Math.round(bounds.height * density));
    request();
  }
  function request() { if (!disposed && !frameRequest) frameRequest = requestAnimationFrame(frame); }
  function frame(timestamp) {
    frameRequest = 0;
    const dt = lastFrame === null ? 1 / 60 : Math.min((timestamp - lastFrame) / 1000, 0.04);
    lastFrame = timestamp;
    if (!active && queue.length) {
      // A backlog (slow network) is played faster so the viewer never falls far behind.
      active = {move: queue.shift(), elapsed: 0, duration: reduced() ? 0 : queue.length > 6 ? 0.05 : 0.18};
    }
    let rotation = null;
    if (active) {
      active.elapsed += dt;
      const progress = active.duration === 0 ? 1 : Math.min(1, active.elapsed / active.duration);
      if (progress >= 1) { cube.apply(active.move); active = null; }
      else rotation = {...active.move, angle: active.move.quarter * Math.PI / 2 * (1 - Math.pow(1 - progress, 3))};
    }
    ctx.setTransform(canvas.width / 420, 0, 0, canvas.height / 370, 0, 0);
    ctx.clearRect(0, 0, 420, 370);
    Toys.drawCube(ctx, cube, {...view, rotation});
    if (active || queue.length) request(); else lastFrame = null;
  }

  function labels() {
    element('time').textContent = Moves.formatTime(watchElapsed(feed, ageMs, receivedAt, performance.now()));
    element('count').textContent = formatNumber.format(feed?.userMoves || 0);
    element('state').textContent = !feed ? 'Wartet auf den ersten Zug …'
      : feed.overflow ? 'Sehr lange Runde: der Würfel wird ab der nächsten Runde wieder gezeigt.'
      : feed.solved ? 'Gelöst' : feed.timerState === 'armed' ? 'Bereit' : feed.timerState === 'running' ? 'Läuft' : 'Noch ein Dreh';
    root.dataset.watchSolved = String(!!feed?.solved);
    const running = feed?.timerState === 'running';
    if (running && !clock) clock = setInterval(labels, 50);
    if (!running && clock) { clearInterval(clock); clock = 0; }
  }

  function update(next, nextAgeMs) {
    feed = next; ageMs = nextAgeMs || 0; receivedAt = performance.now();
    if (next && !next.overflow) {
      const delta = feedDelta(shownRound, shownMoves, next);
      if (delta.reset) {
        queue.length = 0; active = null; cube.reset();
        for (const name of delta.moves) cube.apply(Moves.parseMove(name));
      } else for (const name of delta.append) queue.push(Moves.parseMove(name));
      shownRound = next.round; shownMoves = delta.moves;
      root.dataset.watchMoves = String(delta.moves.length);
    }
    labels(); request();
  }

  // Dragging only turns the view, so the viewer can look at the hidden sides.
  listen(canvas, 'pointerdown', event => { drag = {id: event.pointerId, x: event.clientX, y: event.clientY}; canvas.setPointerCapture(event.pointerId); });
  listen(canvas, 'pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    view.yaw += (event.clientX - drag.x) * 0.008;
    view.pitch = Toys.clamp(view.pitch + (event.clientY - drag.y) * 0.008, -1.2, 1.2);
    drag.x = event.clientX; drag.y = event.clientY; request();
  });
  for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, end, () => { drag = null; });
  listen(canvas, 'keydown', event => {
    const step = {ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2]}[event.key];
    if (!step) return;
    event.preventDefault(); view.yaw += step[0]; view.pitch = Toys.clamp(view.pitch + step[1], -1.2, 1.2); request();
  });
  let observer;
  if ('ResizeObserver' in window) { observer = new ResizeObserver(resize); observer.observe(canvas); } else listen(window, 'resize', resize);
  resize(); labels();
  return {
    update,
    dispose() {
      disposed = true; lifetime.abort(); observer?.disconnect();
      if (clock) clearInterval(clock);
      cancelAnimationFrame(frameRequest);
    }
  };
}
