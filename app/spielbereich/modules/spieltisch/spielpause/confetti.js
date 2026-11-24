/* Short confetti burst on its own canvas. No dependencies; stops itself after a few seconds.
 * Callers skip it entirely under reduced motion. */
const COLORS = ['#f0ebdc', '#e9c745', '#c94c59', '#e48643', '#5da982', '#6399c9', '#b56877'];

export function createConfetti(canvas) {
  let pieces = [], frame = 0, last = 0;
  const ctx = canvas ? canvas.getContext('2d') : null;

  function size() {
    const bounds = canvas.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * density));
    canvas.height = Math.max(1, Math.round(bounds.height * density));
    ctx.setTransform(density, 0, 0, density, 0, 0);
    return bounds;
  }

  function step(timestamp) {
    frame = 0;
    const dt = last ? Math.min(0.04, (timestamp - last) / 1000) : 1 / 60;
    last = timestamp;
    const {width, height} = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    pieces = pieces.filter(piece => piece.life > 0 && piece.y < height + 20);
    for (const piece of pieces) {
      piece.vy += 520 * dt;
      piece.vx *= Math.pow(0.35, dt);
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.spin += piece.turn * dt;
      piece.life -= dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, piece.life * 1.5);
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.spin);
      ctx.scale(1, Math.cos(piece.spin * 1.7));
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }
    if (pieces.length) frame = requestAnimationFrame(step);
    else { ctx.clearRect(0, 0, width, height); last = 0; }
  }

  return {
    burst(count = 160) {
      if (!ctx) return;
      const {width, height} = size();
      for (let index = 0; index < count; index++) {
        const side = index % 2 ? 1 : -1;
        pieces.push({
          x: width / 2 + side * width * 0.18, y: height * 0.55,
          vx: side * (60 + Math.random() * 320) * (Math.random() < 0.3 ? -0.6 : 1),
          vy: -(380 + Math.random() * 420),
          w: 5 + Math.random() * 5, h: 8 + Math.random() * 7,
          spin: Math.random() * Math.PI * 2, turn: (Math.random() - 0.5) * 14,
          color: COLORS[index % COLORS.length], life: 2.6 + Math.random() * 1.2
        });
      }
      if (!frame) { last = 0; frame = requestAnimationFrame(step); }
    },
    stop() {
      pieces = [];
      if (frame) cancelAnimationFrame(frame);
      frame = 0; last = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
