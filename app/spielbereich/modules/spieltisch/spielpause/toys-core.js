/* ChroniPlay Spielpause. Pure toy state and Canvas 2D rendering.
 * The cube stores physical cubies, not six independently recoloured faces.
 * All renderers also run offscreen for deterministic verification.
 */


  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b) => a.map((value, index) => value + b[index]);
  const scale = (a, value) => a.map(component => component * value);
  const axisVector = axis => [0, 1, 2].map(index => index === axis ? 1 : 0);

  const FACE_MOVES = Object.freeze({
    U: { axis: 1, layer: 1, quarter: -1 },
    D: { axis: 1, layer: -1, quarter: 1 },
    F: { axis: 2, layer: 1, quarter: -1 },
    B: { axis: 2, layer: -1, quarter: 1 },
    R: { axis: 0, layer: 1, quarter: -1 },
    L: { axis: 0, layer: -1, quarter: 1 },
    M: { axis: 0, layer: 0, quarter: 1 },
    E: { axis: 1, layer: 0, quarter: 1 },
    S: { axis: 2, layer: 0, quarter: -1 }
  });

  const STICKER_COLORS = Object.freeze({
    U: '#f0ebdc', D: '#e9c745', F: '#c94c59',
    B: '#e48643', R: '#5da982', L: '#6399c9'
  });

  function rotateVector(point, axis, angle) {
    const [x, y, z] = point;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    if (axis === 0) return [x, y * cosine - z * sine, y * sine + z * cosine];
    if (axis === 1) return [x * cosine + z * sine, y, -x * sine + z * cosine];
    return [x * cosine - y * sine, x * sine + y * cosine, z];
  }

  function exactRotation(point, axis, quarter) {
    return rotateVector(point, axis, quarter * Math.PI / 2).map(value => Math.round(value) || 0);
  }

  function inverseMove(move) {
    return { axis: move.axis, layer: move.layer, quarter: -move.quarter };
  }

  function moveLabel(move) {
    const entry = Object.entries(FACE_MOVES).find(([, candidate]) =>
      candidate.axis === move.axis && candidate.layer === move.layer);
    if (!entry) return '';
    return entry[0] + (Math.abs(move.quarter) === 2 ? '2' : move.quarter === entry[1].quarter ? '' : '′');
  }

  function faceFromNormal(normal) {
    const index = normal.findIndex(value => Math.abs(value) > 0.9);
    if (index === 0) return normal[0] > 0 ? 'R' : 'L';
    if (index === 1) return normal[1] > 0 ? 'U' : 'D';
    return normal[2] > 0 ? 'F' : 'B';
  }

  class CubeModel {
    constructor() { this.reset(); }

    reset() {
      this.cubies = [];
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            if (x === 0 && y === 0 && z === 0) continue;
            const position = [x, y, z];
            const stickers = [];
            for (const [name, move] of Object.entries(FACE_MOVES).slice(0, 6)) {
              if (position[move.axis] !== move.layer) continue;
              stickers.push({ normal: scale(axisVector(move.axis), move.layer), color: name });
            }
            this.cubies.push({ id: position.join(','), position, stickers });
          }
        }
      }
    }

    apply(move) {
      if (!Number.isInteger(move.axis) || move.axis < 0 || move.axis > 2 ||
          ![-1, 0, 1].includes(move.layer) || ![-2, -1, 1, 2].includes(move.quarter)) {
        throw new Error('Ungültige Würfeldrehung.');
      }
      for (const cubie of this.cubies) {
        if (cubie.position[move.axis] !== move.layer) continue;
        cubie.position = exactRotation(cubie.position, move.axis, move.quarter);
        cubie.stickers = cubie.stickers.map(sticker => ({
          color: sticker.color,
          normal: exactRotation(sticker.normal, move.axis, move.quarter)
        }));
      }
    }

    isSolved() {
      const colors = new Map();
      for (const cubie of this.cubies) {
        for (const sticker of cubie.stickers) {
          const face = sticker.normal.join(',');
          if (colors.has(face) && colors.get(face) !== sticker.color) return false;
          colors.set(face, sticker.color);
        }
      }
      return colors.size === 6;
    }

    fingerprint() {
      return JSON.stringify(this.cubies.map(cubie => ({
        id: cubie.id, position: cubie.position,
        stickers: cubie.stickers.slice().sort((a, b) => a.color.localeCompare(b.color))
          .map(sticker => ({ color: sticker.color, normal: sticker.normal }))
      })));
    }
  }

  function scrambleMoves(length = 22, random = Math.random) {
    const names = ['U', 'D', 'F', 'B', 'R', 'L'];
    const sequence = [];
    let previousAxis = -1;
    while (sequence.length < length) {
      const available = names.filter(name => FACE_MOVES[name].axis !== previousAxis);
      const name = available[Math.floor(random() * available.length)];
      const base = FACE_MOVES[name];
      const direction = [-1, 1, 2][Math.floor(random() * 3)];
      sequence.push({ ...base, quarter: direction === 2 ? 2 : base.quarter * direction });
      previousAxis = base.axis;
    }
    return sequence;
  }

  class SqueezeModel {
    constructor(count = 0) {
      this.count = count;
      this.value = 0;
      this.velocity = 0;
      this.held = false;
      this.holdTime = 0;
      this.wobble = 0;
      this.wobbleVelocity = 0;
    }

    press() {
      if (this.held) return false;
      this.held = true;
      this.holdTime = 0;
      this.count++;
      this.velocity += 2.3;
      this.wobbleVelocity += this.count % 2 ? -0.35 : 0.35;
      return true;
    }

    release() { this.held = false; }

    step(dt, reducedMotion = false) {
      dt = clamp(dt, 0, 0.032);
      this.holdTime = this.held ? this.holdTime + dt : 0;
      const target = this.held ? 0.68 + Math.min(0.24, this.holdTime * 0.22) : 0;
      if (reducedMotion) {
        this.value = target;
        this.velocity = 0;
        this.wobble = 0;
        return;
      }
      this.velocity += ((target - this.value) * 190 - this.velocity * 18) * dt;
      this.value = clamp(this.value + this.velocity * dt, -0.13, 1.1);
      this.wobbleVelocity += (-this.wobble * 140 - this.wobbleVelocity * 12) * dt;
      this.wobble += this.wobbleVelocity * dt;
    }
  }

  function angleDifference(angle, previous) {
    return Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
  }

  class SpinnerModel {
    constructor() {
      this.angle = 0;
      this.speed = 0;
      this.turns = 0;
      this.dragging = false;
    }

    impulse(direction = 1) {
      this.speed = clamp(this.speed + direction * 15, -62, 62);
    }

    stop() { this.speed = 0; }

    drag(delta, elapsed) {
      this.angle += delta;
      this.turns += Math.abs(delta) / TAU;
      const measured = clamp(delta / Math.max(elapsed, 0.012), -62, 62);
      this.speed = this.speed * 0.3 + measured * 0.7;
    }

    step(dt) {
      dt = clamp(dt, 0, 0.05);
      if (this.dragging) return;
      // Integrate exponential friction exactly so counts do not depend on frame rate.
      const friction = 0.38;
      const after = this.speed * Math.exp(-friction * dt);
      const rotation = (this.speed - after) / friction;
      this.angle += rotation;
      this.turns += Math.abs(rotation) / TAU;
      this.speed = Math.abs(after) < 0.035 ? 0 : after;
      this.angle %= TAU;
    }
  }

  function shade(hex, factor) {
    const value = parseInt(hex.slice(1), 16);
    const rgb = [value >> 16, (value >> 8) & 255, value & 255]
      .map(component => Math.round(clamp(component * factor, 0, 255)));
    return 'rgb(' + rgb.join(',') + ')';
  }

  function roundedPolygon(ctx, points, radius = 3) {
    ctx.beginPath();
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const before = points[(index + points.length - 1) % points.length];
      const after = points[(index + 1) % points.length];
      const previousDistance = Math.hypot(point.x - before.x, point.y - before.y);
      const nextDistance = Math.hypot(point.x - after.x, point.y - after.y);
      const r = Math.min(radius, previousDistance * 0.2, nextDistance * 0.2);
      const start = { x: point.x + (before.x - point.x) * r / previousDistance,
        y: point.y + (before.y - point.y) * r / previousDistance };
      const end = { x: point.x + (after.x - point.x) * r / nextDistance,
        y: point.y + (after.y - point.y) * r / nextDistance };
      if (index === 0) ctx.moveTo(start.x, start.y);
      else ctx.lineTo(start.x, start.y);
      ctx.quadraticCurveTo(point.x, point.y, end.x, end.y);
    }
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }

  function softShadow(ctx, x, y, radiusX, radiusY, opacity = 0.38) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, radiusY / radiusX);
    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, radiusX);
    gradient.addColorStop(0, 'rgba(7,4,12,' + opacity + ')');
    gradient.addColorStop(1, 'rgba(7,4,12,0)');
    ellipse(ctx, 0, 0, radiusX, radiusX, gradient);
    ctx.restore();
  }

  function cubeCamera(width, height, view) {
    const distance = 9;
    const zoom = Math.min(width / 6.5, height / 5.5);
    const transform = point => rotateVector(rotateVector(point, 1, view.yaw), 0, view.pitch);
    const project = point => {
      const [x, y, z] = transform(point);
      const perspective = distance / (distance - z);
      return { x: width / 2 + x * zoom * perspective,
        y: height * 0.465 - y * zoom * perspective, z };
    };
    return { transform, project, distance };
  }

  function faceCorners(center, normal, size) {
    const axis = normal.findIndex(value => Math.abs(value) > 0.5);
    const u = axisVector((axis + 1) % 3), v = axisVector((axis + 2) % 3);
    const base = add(center, scale(normal, 0.485));
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
      add(add(base, scale(u, a * size)), scale(v, b * size)));
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if (((a.y > point.y) !== (b.y > point.y)) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function drawCube(ctx, model, options, width = 420, height = 370) {
    const camera = cubeCamera(width, height, options);
    const zoom = Math.min(width / 420, height / 370);
    softShadow(ctx, width / 2, height * 0.84, 135 * zoom, 28 * zoom, 0.55);
    const faces = [];
    for (const cubie of model.cubies) {
      const active = options.rotation && cubie.position[options.rotation.axis] === options.rotation.layer;
      const turn = point => active ? rotateVector(point, options.rotation.axis, options.rotation.angle) : point;
      for (let axis = 0; axis < 3; axis++) {
        for (const sign of [-1, 1]) {
          const normal = scale(axisVector(axis), sign);
          const center = turn(add(cubie.position, scale(normal, 0.485)));
          const visibleNormal = camera.transform(turn(normal));
          const cameraCenter = camera.transform(center);
          if (dot(visibleNormal, [-cameraCenter[0], -cameraCenter[1], camera.distance - cameraCenter[2]]) <= 0) continue;
          const corners = faceCorners(cubie.position, normal, 0.485).map(turn).map(camera.project);
          const sticker = cubie.stickers.find(item => dot(item.normal, normal) > 0.9);
          faces.push({ corners, normal, visibleNormal, cubie, center,
            depth: corners.reduce((sum, point) => sum + point.z, 0) / 4,
            sticker,
            stickerCorners: sticker ? faceCorners(cubie.position, normal, 0.397).map(turn).map(camera.project) : null
          });
        }
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      const light = 0.79 + Math.max(0, dot(face.visibleNormal, [-0.25, 0.68, 0.66])) * 0.37;
      roundedPolygon(ctx, face.corners, 4 * zoom);
      ctx.fillStyle = shade('#24202b', light);
      ctx.fill();
      ctx.strokeStyle = 'rgba(215,206,226,0.11)';
      ctx.lineWidth = 0.8 * zoom;
      ctx.stroke();
      if (!face.sticker) continue;
      roundedPolygon(ctx, face.stickerCorners, 3.5 * zoom);
      const diagonal = face.stickerCorners;
      const paint = ctx.createLinearGradient(diagonal[0].x, diagonal[0].y, diagonal[2].x, diagonal[2].y);
      paint.addColorStop(0, shade(STICKER_COLORS[face.sticker.color], light * 1.07));
      paint.addColorStop(1, shade(STICKER_COLORS[face.sticker.color], light * 0.87));
      ctx.fillStyle = paint;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.19)';
      ctx.lineWidth = 0.75 * zoom;
      ctx.stroke();
    }
    return { camera, hits: faces.filter(face => face.sticker) };
  }

  function pickCube(rendered, point) {
    for (let index = rendered.hits.length - 1; index >= 0; index--) {
      const hit = rendered.hits[index];
      if (pointInPolygon(point, hit.corners)) return hit;
    }
    return null;
  }

  function swipeMove(hit, direction, camera) {
    const excludedAxis = hit.normal.findIndex(component => Math.abs(component) > 0.5);
    const screenAnchor = camera.project(hit.center);
    let best = null;
    for (let axis = 0; axis < 3; axis++) {
      if (axis === excludedAxis) continue;
      const end = camera.project(rotateVector(hit.center, axis, 0.08));
      const tangent = [end.x - screenAnchor.x, end.y - screenAnchor.y];
      const length = Math.hypot(...tangent);
      if (length < 0.01) continue;
      const unit = tangent.map(value => value / length);
      const alignment = unit[0] * direction.x + unit[1] * direction.y;
      if (!best || Math.abs(alignment) > best.score) {
        best = { axis, layer: hit.cubie.position[axis], unit, score: Math.abs(alignment) };
      }
    }
    return best;
  }

  function heart(ctx, x, y, size, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.beginPath();
    ctx.moveTo(0, 0.8);
    ctx.bezierCurveTo(-1.3, -0.1, -0.7, -1.2, 0, -0.5);
    ctx.bezierCurveTo(0.7, -1.2, 1.3, -0.1, 0, 0.8);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function drawVampire(ctx, state, width = 420, height = 370) {
    const fit = Math.min(width / 420, height / 370) * (state.bubble ? 0.84 : 1);
    const squish = clamp(state.value || 0, -0.13, 1.1);
    softShadow(ctx, width / 2, height * 0.87, (96 + squish * 28) * fit, 18 * fit, 0.52);
    ctx.save();
    ctx.translate(width / 2, height * 0.86);
    ctx.rotate(state.wobble || 0);
    ctx.scale(fit * (1 + squish * 0.34), fit * (1 - squish * 0.28));

    // The texture moves through the same squeeze physics as the original drawing.
    if (state.asset) {
      const assetHeight = 300;
      const assetWidth = assetHeight * state.asset.width / state.asset.height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(state.asset, -assetWidth / 2, -assetHeight, assetWidth, assetHeight);
      ctx.restore();
      return;
    }

    // Scalloped cape, kept behind the body and head.
    const cape = ctx.createLinearGradient(-90, -185, 100, -40);
    cape.addColorStop(0, '#482737'); cape.addColorStop(0.5, '#221e2b'); cape.addColorStop(1, '#6e3144');
    ctx.beginPath();
    ctx.moveTo(-38, -181);
    ctx.bezierCurveTo(-98, -176, -80, -110, -126, -54);
    ctx.quadraticCurveTo(-102, -69, -88, -45);
    ctx.quadraticCurveTo(-70, -66, -50, -37);
    ctx.quadraticCurveTo(-25, -55, 0, -32);
    ctx.quadraticCurveTo(25, -55, 50, -37);
    ctx.quadraticCurveTo(70, -66, 88, -45);
    ctx.quadraticCurveTo(102, -69, 126, -54);
    ctx.bezierCurveTo(80, -110, 98, -176, 38, -181);
    ctx.closePath(); ctx.fillStyle = cape; ctx.fill();
    ctx.strokeStyle = '#895264'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(210,148,156,0.24)'; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(-48, -170); ctx.quadraticCurveTo(-76, -115, -105, -64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, -170); ctx.quadraticCurveTo(76, -115, 105, -64); ctx.stroke();
    ctx.setLineDash([]);

    // Soft boots and a very small, very serious waistcoat.
    ellipse(ctx, -30, -15, 29, 17, '#1b1923');
    ellipse(ctx, 30, -15, 29, 17, '#1b1923');
    ctx.fillStyle = '#26222e'; ctx.beginPath(); ctx.roundRect(-50, -73, 100, 57, 21); ctx.fill();
    const coat = ctx.createLinearGradient(-52, -158, 50, -60);
    coat.addColorStop(0, '#a55467'); coat.addColorStop(0.45, '#7d354c'); coat.addColorStop(1, '#502639');
    ctx.fillStyle = coat; ctx.beginPath(); ctx.roundRect(-54, -168, 108, 116, 31); ctx.fill();
    ctx.strokeStyle = '#bd7b88'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ddd0c9';
    ctx.beginPath(); ctx.moveTo(-28, -165); ctx.lineTo(0, -107); ctx.lineTo(28, -165); ctx.fill();
    ctx.fillStyle = '#3d2735';
    ctx.beginPath(); ctx.moveTo(-20, -155); ctx.lineTo(0, -143); ctx.lineTo(-20, -134); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20, -155); ctx.lineTo(0, -143); ctx.lineTo(20, -134); ctx.fill();
    [112, 94, 76].forEach(y => ellipse(ctx, 0, -y, 3, 3, '#c9a877'));
    ctx.strokeStyle = 'rgba(237,197,187,0.4)'; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(-37, -123); ctx.lineTo(-37, -73); ctx.stroke(); ctx.setLineDash([]);

    // Hands, triangular ears, then the big plush head.
    const skin = ctx.createLinearGradient(-60, -280, 65, -164);
    skin.addColorStop(0, '#f1e1da'); skin.addColorStop(0.52, '#d8c7d4'); skin.addColorStop(1, '#b59aac');
    ellipse(ctx, -67, -111, 19, 23, skin);
    ellipse(ctx, 67, -111, 19, 23, skin);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1);
      ctx.beginPath(); ctx.moveTo(60, -235); ctx.quadraticCurveTo(83, -255, 91, -248);
      ctx.quadraticCurveTo(90, -214, 62, -204); ctx.closePath(); ctx.fillStyle = '#c9a9bd'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(73, -230); ctx.lineTo(85, -242); ctx.quadraticCurveTo(82, -222, 73, -220);
      ctx.fillStyle = '#aa718d'; ctx.fill(); ctx.restore();
    }
    ellipse(ctx, 0, -217, 74, 64, skin);
    ctx.strokeStyle = 'rgba(245,228,221,0.55)'; ctx.lineWidth = 1; ctx.stroke();

    const hair = ctx.createLinearGradient(-60, -282, 60, -204);
    hair.addColorStop(0, '#51424e'); hair.addColorStop(0.3, '#29232f'); hair.addColorStop(1, '#191722');
    ctx.beginPath();
    ctx.moveTo(-72, -214); ctx.bezierCurveTo(-83, -261, -52, -288, -16, -279);
    ctx.quadraticCurveTo(10, -303, 31, -276); ctx.bezierCurveTo(66, -271, 83, -247, 72, -212);
    ctx.lineTo(57, -237); ctx.quadraticCurveTo(32, -245, 0, -229);
    ctx.quadraticCurveTo(-27, -253, -54, -237); ctx.closePath(); ctx.fillStyle = hair; ctx.fill();
    ctx.strokeStyle = '#695663'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-46, -264); ctx.quadraticCurveTo(-17, -275, 10, -258); ctx.stroke();

    // An embroidered repair seam and rosy felt cheeks.
    ctx.strokeStyle = '#aa839d'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(43, -244); ctx.lineTo(57, -226); ctx.stroke();
    for (let index = 0; index < 4; index++) {
      const x = 44 + index * 3.5, y = -242 + index * 4.5;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 1); ctx.lineTo(x + 3, y - 2); ctx.stroke();
    }
    ellipse(ctx, -44, -198, 14, 7, squish > 0.4 ? '#c7859e' : '#c99cac');
    ellipse(ctx, 44, -198, 14, 7, squish > 0.4 ? '#c7859e' : '#c99cac');
    const eyeX = clamp(state.eyeX || 0, -3, 3), eyeY = clamp(state.eyeY || 0, -2, 2);
    const closed = state.blink || squish > 0.55;
    for (const x of [-27, 27]) {
      if (closed) {
        ctx.strokeStyle = '#463242'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 8, -213); ctx.quadraticCurveTo(x, -220, x + 8, -213); ctx.stroke();
      } else {
        ellipse(ctx, x + eyeX, -213 + eyeY, 9, 12, '#352b3c');
        ellipse(ctx, x - 2 + eyeX, -218 + eyeY, 3, 4, '#fcf1e5');
        ellipse(ctx, x + 3 + eyeX, -209 + eyeY, 1.6, 1.6, '#c4a0b3');
      }
      ctx.strokeStyle = '#514051'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 8, -232); ctx.quadraticCurveTo(x, -236, x + 7, -231); ctx.stroke();
    }
    ellipse(ctx, 0, -200, 3.2, 2.2, '#b78da1');
    ellipse(ctx, 0, -184, squish > 0.5 ? 17 : 20, squish > 0.5 ? 11 : 13, '#6b354e');
    ellipse(ctx, 0, -178, 10, 4, '#ba758b');
    ctx.fillStyle = '#fff3df';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * 10 - 4, -194); ctx.lineTo(side * 10 + 4, -193);
      ctx.lineTo(side * 10, -182); ctx.closePath(); ctx.fill();
    }

    // A little heart sewn to one foot.
    heart(ctx, 34, -14, 6, '#a75368');
    ctx.restore();
  }

  function spinnerOutline(ctx, inset = 0, yOffset = 0) {
    ctx.beginPath();
    for (let index = 0; index <= 240; index++) {
      const angle = index / 240 * TAU;
      const radius = 91 + 25 * Math.cos((angle + Math.PI / 2) * 3) - inset;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius + yOffset;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawSpinner(ctx, state, width = 420, height = 370) {
    const fit = Math.min(width / 420, height / 370);
    softShadow(ctx, width / 2, height * 0.84, 127 * fit, 24 * fit, 0.48);
    ctx.save(); ctx.translate(width / 2, height * 0.47); ctx.scale(fit, fit * 0.96);
    ctx.rotate(state.angle || 0);
    if (state.asset) {
      const size = 270;
      const ratio = state.asset.width / state.asset.height;
      const w = ratio > 1 ? size : size * ratio;
      const h = ratio > 1 ? size / ratio : size;
      ctx.drawImage(state.asset, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    spinnerOutline(ctx, 0, 7); ctx.fillStyle = '#18141d'; ctx.fill();
    const rim = ctx.createLinearGradient(-95, -120, 100, 100);
    rim.addColorStop(0, '#e4ceaa'); rim.addColorStop(0.25, '#7c6558');
    rim.addColorStop(0.5, '#c3a185'); rim.addColorStop(0.8, '#62504c'); rim.addColorStop(1, '#bc9e7f');
    spinnerOutline(ctx); ctx.fillStyle = rim; ctx.fill();
    const metal = ctx.createLinearGradient(-100, -95, 95, 100);
    metal.addColorStop(0, '#4e4653'); metal.addColorStop(0.3, '#302a39');
    metal.addColorStop(0.62, '#211c29'); metal.addColorStop(1, '#51414b');
    spinnerOutline(ctx, 4); ctx.fillStyle = metal; ctx.fill();
    ctx.strokeStyle = '#71606c'; ctx.lineWidth = 1; ctx.stroke();
    spinnerOutline(ctx, 9); ctx.strokeStyle = 'rgba(216,186,159,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
    for (let lobe = 0; lobe < 3; lobe++) {
      const angle = -Math.PI / 2 + lobe * TAU / 3;
      const x = Math.cos(angle) * 77, y = Math.sin(angle) * 77;
      ellipse(ctx, x, y + 2, 30, 30, '#14131b');
      ellipse(ctx, x, y, 29, 29, rim);
      ellipse(ctx, x, y, 25, 25, '#211c2a');
      const garnet = ctx.createLinearGradient(x - 15, y - 18, x + 15, y + 18);
      garnet.addColorStop(0, '#b56877'); garnet.addColorStop(0.3, '#8a4057'); garnet.addColorStop(1, '#4a253d');
      ellipse(ctx, x, y, 20, 20, garnet);
      ellipse(ctx, x, y + 1, 11, 11, '#1a1623');
      ctx.strokeStyle = '#bb8c8c'; ctx.lineWidth = 1.1; ctx.stroke();
      ellipse(ctx, x, y, 6.8, 6.8, '#302637');
      for (let notch = 0; notch < 12; notch++) {
        const a = notch * TAU / 12;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
        ctx.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24);
        ctx.strokeStyle = 'rgba(219,184,158,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ellipse(ctx, 0, 4, 34, 34, '#16121b');
    ellipse(ctx, 0, 0, 33, 33, rim);
    ellipse(ctx, 0, 0, 27, 27, '#372536');
    const cap = ctx.createRadialGradient(-9, -12, 1, 0, 0, 26);
    cap.addColorStop(0, '#a26572'); cap.addColorStop(0.5, '#7e4359'); cap.addColorStop(1, '#4c2b40');
    ellipse(ctx, 0, 0, 24, 24, cap);
    ctx.strokeStyle = '#b58b8d'; ctx.lineWidth = 0.75; ctx.stroke();
    // Crescent embossed into the thumb cap.
    ctx.fillStyle = '#dbc5a6'; ctx.beginPath();
    ctx.moveTo(6, -12); ctx.bezierCurveTo(-11, -17, -18, 9, 1, 13);
    ctx.bezierCurveTo(10, 15, 13, 7, 13, 4); ctx.bezierCurveTo(-2, 12, -8, -6, 6, -12); ctx.fill();
    ctx.restore();
  }

export {
    TAU, clamp, rotateVector, inverseMove, moveLabel, faceFromNormal,
    FACE_MOVES, STICKER_COLORS, CubeModel, SqueezeModel, SpinnerModel,
    scrambleMoves, angleDifference, drawCube, pickCube, swipeMove,
    drawVampire, drawSpinner, softShadow
};
