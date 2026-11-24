const brickGoal = 12;
const brickRadius = 13;
const brickStarTiles = new Set([2, 7, 10]);
const brickClamp = (value, min, max) => Math.min(max, Math.max(min, value));
const brickPalette = [
  ["#ffb19b", "#f65d7c", "#a03462", "#fff0b1"], ["#fff2aa", "#ffc653", "#bb713b", "#fffbe0"],
  ["#9ef4fd", "#5badee", "#3e5fae", "#ffeeb6"], ["#b2ffc1", "#60d7a3", "#28847e", "#e6ffbc"],
  ["#f6c4ff", "#ba82f8", "#704daf", "#fff1ba"],
];

function brickSweep(ball, box, dt) {
  const { x, y, vx, vy, r } = ball;
  const right = box.x + box.w, bottom = box.y + box.h;
  let earliest = null;
  function consider(t, nx, ny) {
    if (t < -1e-8 || t > dt || vx * nx + vy * ny >= -0.00001 || (earliest && earliest.t <= t)) return;
    earliest = { t: Math.max(0, t), nx, ny };
  }
  const normalX = x - brickClamp(x, box.x, right), normalY = y - brickClamp(y, box.y, bottom);
  const overlap = Math.hypot(normalX, normalY);
  if (overlap > 0 && overlap < r) consider(0, normalX / overlap, normalY / overlap);

  if (vx) {
    const nx = vx > 0 ? -1 : 1;
    const t = ((nx < 0 ? box.x : right) + nx * r - x) / vx;
    const crossing = y + vy * t;
    if (crossing >= box.y && crossing <= bottom) consider(t, nx, 0);
  }
  if (vy) {
    const ny = vy > 0 ? -1 : 1;
    const t = ((ny < 0 ? box.y : bottom) + ny * r - y) / vy;
    const crossing = x + vx * t;
    if (crossing >= box.x && crossing <= right) consider(t, 0, ny);
  }
  const speed2 = vx * vx + vy * vy;
  if (!speed2) return earliest;
  for (const [cx, nx] of [[box.x, -1], [right, 1]]) {
    for (const [cy, ny] of [[box.y, -1], [bottom, 1]]) {
      const dx = x - cx, dy = y - cy;
      const dot = dx * vx + dy * vy;
      const discriminant = dot * dot - speed2 * (dx * dx + dy * dy - r * r);
      if (dot >= 0 || discriminant < 0) continue;
      const t = (-dot - Math.sqrt(discriminant)) / speed2;
      const ax = dx + vx * t, ay = dy + vy * t;
      if (ax * nx >= -1e-8 && ay * ny >= -1e-8) consider(t, ax / r, ay / r);
    }
  }
  return earliest;
}

function createBrickRound(width = 900, height = 610) {
  const ball = { x: width / 2, y: height - 83, vx: 0, vy: 0, r: brickRadius };
  const game = { width, height, ball, center: width / 2, time: 0, count: 0, phase: "serve", phaseEnd: 0.62,
    fanfareAt: null, wideUntil: 0, stars: [], bricks: Array.from({ length: brickGoal }, (_, id) => ({ id, alive: true })) };

  function layout() {
    const gap = game.width * 0.019;
    const w = game.width * 0.192, h = game.height * 0.083;
    const left = (game.width - 4 * w - 3 * gap) / 2;
    for (const brick of game.bricks) Object.assign(brick, {
      x: left + brick.id % 4 * (w + gap), y: game.height * (0.125 + Math.floor(brick.id / 4) * 0.108), w, h,
    });
  }
  layout();

  function paddle() {
    const w = game.width * (game.time < game.wideUntil ? 0.31 : 0.221);
    return { x: game.center - w / 2, y: game.height - 51, w, h: 23 };
  }

  function steer(x) {
    const half = paddle().w / 2;
    game.center = brickClamp(x, half + 8, game.width - half - 8);
    if (game.phase === "serve") Object.assign(ball, { x: game.center, y: paddle().y - ball.r - 5 });
  }

  function resize(w, h) {
    if (w === game.width && h === game.height) return;
    const fx = w / game.width, fy = h / game.height;
    const center = game.center * fx;
    const inLane = ball.y > paddle().y - ball.r && game.phase === "play";
    ball.x = brickClamp(ball.x * fx, ball.r, w - ball.r);
    ball.y = inLane ? h - (game.height - ball.y) : Math.max(ball.r, ball.y * fy);
    for (const star of game.stars) { star.x *= fx;star.y *= fy; }
    game.width = w;
    game.height = h;
    layout();
    steer(center);
  }

  function launch() {
    const nearest = game.bricks.filter((brick) => brick.alive).reduce((best, brick) =>
      !best || Math.abs(brick.x + brick.w / 2 - ball.x) < Math.abs(best.x + best.w / 2 - ball.x) ? brick : best, null);
    if (!nearest) return;
    const angle = brickClamp(Math.atan2(nearest.x + nearest.w / 2 - ball.x, ball.y - nearest.y), -0.49, 0.49);
    const speed = 315 + game.count * 12;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    game.phase = "play";
  }

  function hitBrick(brick, events) {
    brick.alive = false;
    game.count += 1;
    const x = brick.x + brick.w / 2, y = brick.y + brick.h / 2;
    events.push({ kind: game.count === brickGoal ? "last" : "brick", x, y, id: brick.id });
    if (game.count === brickGoal) {
      game.phase = "celebrate";
      game.phaseEnd = game.time + 1.48;
      game.fanfareAt = game.time + 0.30;
      game.stars.length = 0;
    } else if (brickStarTiles.has(brick.id)) {
      game.stars.push({ x, y });
    }
  }

  function reflect(nx, ny) {
    const into = ball.vx * nx + ball.vy * ny;
    if (into < 0) { ball.vx -= 2 * into * nx;ball.vy -= 2 * into * ny; }
  }

  function boundSpeed(speed) {
    const angle = Math.atan2(ball.vx, Math.abs(ball.vy));
    const bounded = brickClamp(angle, -1.26, 1.26);
    ball.vx = Math.sin(bounded) * speed;
    ball.vy = Math.sign(ball.vy || -1) * Math.cos(bounded) * speed;
  }

  function travel(dt, events) {
    // Sweep the full flight to the earliest face or rounded corner, then use the remaining time.
    for (let bounces = 0; dt > 0.00001 && bounces < 8; bounces += 1) {
      const candidates = [];
      function wall(t, nx, ny) {
        if (t >= -0.00001 && t <= dt) candidates.push({ t: Math.max(0, t), nx, ny, kind: "wall" });
      }
      if (ball.vx < 0) wall((ball.r - ball.x) / ball.vx, 1, 0);
      if (ball.vx > 0) wall((game.width - ball.r - ball.x) / ball.vx, -1, 0);
      if (ball.vy < 0) wall((ball.r - ball.y) / ball.vy, 0, 1);
      const p = paddle();
      if (ball.vy > 0 && ball.y <= p.y) {
        const impact = brickSweep(ball, p, dt);
        if (impact) candidates.push({ ...impact, kind: "paddle" });
      }
      for (const brick of game.bricks) {
        if (!brick.alive) continue;
        const impact = brickSweep(ball, brick, dt);
        if (impact) candidates.push({ ...impact, kind: "brick", brick });
      }
      if (!candidates.length) { ball.x += ball.vx * dt;ball.y += ball.vy * dt;return; }
      const time = Math.min(...candidates.map(({ t }) => t));
      ball.x += ball.vx * time;
      ball.y += ball.vy * time;
      dt -= Math.max(time, 0.00003);
      const hits = candidates.filter(({ t }) => Math.abs(t - time) < 0.00001);
      const brickHits = hits.filter(({ kind }) => kind === "brick");
      const brick = brickHits[0];
      const racket = hits.find(({ kind }) => kind === "paddle");
      const speed = brickClamp(Math.hypot(ball.vx, ball.vy) + (brick ? 11 : 0), 310, 475);
      if (brick) {
        hitBrick(brick.brick, events);
        if (game.phase === "celebrate") return;
        const nx = brickHits.reduce((n, hit) => n + hit.nx, 0);
        const ny = brickHits.reduce((n, hit) => n + hit.ny, 0);
        const length = Math.hypot(nx, ny);
        const face = length ? { nx: nx / length, ny: ny / length } : brick;
        reflect(face.nx, face.ny);
        ball.x += face.nx * 0.04;ball.y += face.ny * 0.04;
      }
      if (racket) {
        const offset = brickClamp((ball.x - game.center) / (p.w / 2 + ball.r * 0.7), -1, 1);
        let angle = Math.abs(offset) < 0.12 ? offset * 0.73 : offset * 1.08;
        if (Math.abs(angle) < 0.035 && !game.bricks.some((item) => item.alive && ball.x >= item.x && ball.x <= item.x + item.w)) {
          const remaining = game.bricks.find((item) => item.alive);
          angle = 0.11 * Math.sign(remaining.x + remaining.w / 2 - ball.x);
        }
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = Math.min(ball.y, p.y - ball.r - 0.04);
        events.push({ kind: "paddle", x: ball.x, y: p.y });
      }
      for (const hit of hits.filter(({ kind }) => kind === "wall")) {
        reflect(hit.nx, hit.ny);
        ball.x += hit.nx * 0.05;ball.y += hit.ny * 0.05;
      }
      if (!brick && !racket) events.push({ kind: "wall", x: ball.x, y: ball.y });
      boundSpeed(speed);
    }
  }

  function advance(seconds) {
    const events = [];
    while (seconds > 0.00001 && game.phase !== "won") {
      const dt = Math.min(seconds, 1 / 100);
      seconds -= dt;
      game.time += dt;
      if (game.phase === "celebrate") {
        if (game.fanfareAt !== null && game.time >= game.fanfareAt) {
          game.fanfareAt = null;events.push({ kind: "fanfare" });
        }
        if (game.time >= game.phaseEnd) { game.phase = "won";events.push({ kind: "win" }); }
        continue;
      }
      if (game.phase === "serve") {
        steer(game.center);
        if (game.time >= game.phaseEnd) launch();
      } else {
        travel(dt, events);
        if (ball.y > game.height + ball.r && game.phase === "play") {
          events.push({ kind: "miss", x: ball.x, y: game.height - 8 });
          game.phase = "serve";
          game.phaseEnd = game.time + 0.54;
          steer(game.center);
        }
      }
      const p = paddle();
      for (let i = game.stars.length - 1; i >= 0; i -= 1) {
        const star = game.stars[i];
        const from = star.y;
        star.y += 210 * dt;
        if (from <= p.y + 13 && star.y >= p.y - 13 && star.x >= p.x - 13 && star.x <= p.x + p.w + 13) {
          game.wideUntil = game.time + 6.2;
          steer(game.center);
          events.push({ kind: "star", x: star.x, y: p.y });
          game.stars.splice(i, 1);
        } else if (star.y > game.height + 18) game.stars.splice(i, 1);
      }
    }
    return events;
  }

  return { game, steer, paddle, resize, advance };
}

function bindBrickControls(dialog, canvas, signal, steer) {
  let pointer = null;
  const arrows = new Set();
  const move = (event) => steer(event.clientX);
  function cancel() {
    const active = pointer;
    pointer = null;
    arrows.clear();
    if (active !== null && canvas.hasPointerCapture(active)) canvas.releasePointerCapture(active);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    arrows.clear();
    canvas.setPointerCapture(pointer);
    move(event);
  }, { signal });
  canvas.addEventListener("pointermove", (event) => { if (event.pointerId === pointer) move(event); }, { signal });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, (event) => { if (event.pointerId === pointer) cancel(); }, { signal });
  }
  dialog.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    if (pointer === null) arrows.add(event.key);
  }, { signal });
  dialog.addEventListener("keyup", (event) => { arrows.delete(event.key); }, { signal });
  signal.addEventListener("abort", cancel, { once: true });
  return { cancel, direction: () => Number(arrows.has("ArrowRight")) - Number(arrows.has("ArrowLeft")) };
}

function brickView(width, height) {
  const portrait = width < height;
  const fieldWidth = portrait ? 720 : 900, fieldHeight = portrait ? 848 : 610;
  const pad = portrait ? 14 : 26;
  const scale = Math.max(0.01, Math.min((width - pad * 2) / fieldWidth, (height - pad * 2) / fieldHeight));
  return { width, height, fieldWidth, fieldHeight, scale, x: (width - fieldWidth * scale) / 2, y: (height - fieldHeight * scale) / 2 };
}

function brickPaint(ctx, y, end, stops) {
  const paint = ctx.createLinearGradient(0, y, 0, end);
  stops.forEach(([at, color]) => paint.addColorStop(at, color));
  return paint;
}

function brickShape(ctx, x, y, w, h, radius, color) {
  ctx.beginPath();ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;ctx.fill();
}

function brickOval(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;ctx.fill();
}

function brickSpark(ctx, x, y, radius, color, angle = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const r = radius * (i % 2 ? 0.38 : 1), a = angle + i * Math.PI / 4;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();ctx.fillStyle = color;ctx.fill();
}

function drawBrickCabinet(ctx, view) {
  const { width, height, x, y, fieldWidth: fw, fieldHeight: fh, scale: s } = view;
  ctx.fillStyle = brickPaint(ctx, 0, height, [[0, "#252849"], [0.52, "#214a5e"], [1, "#392a53"]]);
  ctx.fillRect(0, 0, width, height);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : width;
    const inner = side < 0 ? x : x + fw * s;
    const gutter = Math.abs(edge - inner);
    ctx.beginPath();ctx.moveTo(edge, height * 0.12);ctx.lineTo(inner, height * 0.31);
    ctx.lineTo(inner, height * 0.84);ctx.lineTo(edge, height * 0.94);ctx.closePath();
    ctx.fillStyle = side < 0 ? "#42607a" : "#4e4c73";ctx.fill();
    for (let j = 0; j < 7; j += 1) {
      const start = height * (0.12 + j * 0.12);
      ctx.beginPath();ctx.moveTo(edge, start);ctx.lineTo(inner, start + height * (3 - j) * 0.065);
      ctx.lineWidth = j % 2 ? 2 : 4;ctx.strokeStyle = j % 2 ? "#c5c3ec30" : side < 0 ? "#71e2bc80" : "#f686a080";ctx.stroke();
    }
    if (gutter >= 58) {
      const at = (edge + inner) / 2;
      const disc = Math.min(43, gutter * 0.30);
      brickOval(ctx, at, height * 0.48, disc, disc, "#243355");
      brickOval(ctx, at, height * 0.48, disc * 0.86, disc * 0.86, side < 0 ? "#40898c" : "#a36094");
      brickSpark(ctx, at, height * 0.48, disc * 0.56, side < 0 ? "#b8ffd2" : "#ffce9e", Math.PI / 4);
      for (const line of [-1, 1]) {
        for (let j = 0; j < 3; j += 1) brickOval(ctx, at, height * 0.48 + line * (disc + 19 + j * 13), 3, 3, "#e7dc9c");
      }
    }
  }

  ctx.save();ctx.translate(x, y);ctx.scale(s, s);
  brickShape(ctx, -12, -12, fw + 24, fh + 24, 29, "#152842");
  brickShape(ctx, -6, -6, fw + 12, fh + 12, 24, brickPaint(ctx, -6, fh, [[0, "#a8f1e3"], [0.25, "#72bbc6"], [0.86, "#766cb4"], [1, "#d99dc9"]]));
  brickShape(ctx, 0, 0, fw, fh, 20, brickPaint(ctx, 0, fh, [[0, "#534577"], [0.26, "#304969"], [0.7, "#254e68"], [1, "#283351"]]));
  ctx.save();ctx.beginPath();ctx.roundRect(0, 0, fw, fh, 20);ctx.clip();

  const floor = brickPaint(ctx, fh * 0.59, fh, [[0, "#29486400"], [0.65, "#637bac26"], [1, "#9c83c333"]]);
  ctx.fillStyle = floor;ctx.fillRect(0, fh * 0.59, fw, fh * 0.41);
  for (let i = -5; i <= 5; i += 1) {
    ctx.beginPath();ctx.moveTo(fw / 2 + i * 33, fh * 0.61);ctx.lineTo(fw / 2 + i * 110, fh);
    ctx.lineWidth = 1.4;ctx.strokeStyle = "#8ea7e032";ctx.stroke();
  }
  for (const at of [0.71, 0.78, 0.87, 0.98]) {
    ctx.fillStyle = "#a9b6d127";ctx.fillRect(0, fh * at, fw, 1.2);
  }
  for (let i = 0; i < 30; i += 1) {
    const px = fw * ((i * 51 + 7) % 101) / 101;
    const py = fh * ((i * 23 + 3) % 97) / 100;
    if (i % 6 === 0) brickSpark(ctx, px, py, 7 + i % 3, "#d5f9f448", Math.PI / 4);
    else brickOval(ctx, px, py, 1.5, 1.5, i % 3 ? "#b3d6e83f" : "#ffe2a55d");
  }
  ctx.fillStyle = "#536a9370";ctx.fillRect(0, fh - 16, fw, 16);
  for (let i = 0; i < 12; i += 1) {
    brickShape(ctx, 24 + i * (fw - 48) / 12, fh - 10, (fw - 48) / 12 - 8, 3, 1.5, i % 3 ? "#6ba0bb" : "#f1b8c5");
  }
  ctx.restore();
  for (const px of [16, fw - 16]) for (const py of [16, fh - 16]) {
    brickOval(ctx, px, py, 5, 5, "#2d405d");
    brickOval(ctx, px - 1, py - 1, 2.5, 2.5, "#b5ded8");
  }
  ctx.restore();
}

function drawBrickTile(ctx, tile, clock, reduced) {
  const { x, y, w, h, id } = tile;
  const [glint, color, shade, accent] = brickPalette[(id + 2 * Math.floor(id / 4)) % brickPalette.length];
  brickShape(ctx, x + 3, y + 8, w, h, 13, "#17263d75");
  brickShape(ctx, x, y, w, h, 12, brickPaint(ctx, y, y + h, [[0, glint], [0.33, color], [1, shade]]));
  brickShape(ctx, x + 4, y + 5, w - 8, h - 11, 9, brickPaint(ctx, y + 5, y + h - 5, [[0, glint], [0.45, color], [1, color]]));
  brickShape(ctx, x + 11, y + 8, w * 0.33, 4.5, 2.25, "#ffffff8f");
  brickShape(ctx, x + w - 22, y + 8, 9, 4.5, 2.25, "#ffffff76");
  const mx = x + w / 2, my = y + h * 0.54;
  if (!brickStarTiles.has(id)) {
    const blink = !reduced && (clock + id * 0.59) % 6.4 > 6.24;
    const gap = Math.min(16, w * 0.14);
    for (const dx of [-gap, gap]) {
      brickOval(ctx, mx + dx, my - 3, 7.1, blink ? 1.3 : 8.2, "#fff9e3");
      if (!blink) {
        brickOval(ctx, mx + dx + 1.4, my - 2, 3.9, 5.1, "#213455");
        brickOval(ctx, mx + dx + 0.3, my - 4.5, 1.35, 1.65, "#fff");
      }
      brickOval(ctx, mx + dx * 1.63, my + 7, 4.4, 2.6, "#ffb2b2");
    }
    ctx.beginPath();ctx.moveTo(mx - 4, my + 7);ctx.quadraticCurveTo(mx, my + 12 + id % 2, mx + 4, my + 7);
    ctx.lineWidth = 2.5;ctx.strokeStyle = "#593b65";ctx.lineCap = "round";ctx.stroke();
  } else {
    brickSpark(ctx, mx, my, 13, accent, Math.PI / 4);
    brickSpark(ctx, mx - 22, my + 2, 5.5, "#ffffff85");
    brickSpark(ctx, mx + 22, my + 2, 5.5, "#ffffff85");
  }
}

function drawBrickPaddle(ctx, p, game, impact, reduced) {
  const wide = game.time < game.wideUntil;
  const dip = reduced ? 0 : Math.max(0, 1 - (game.time - impact) * 6) * 5;
  const { x, w, h } = p;
  const y = p.y + dip;
  brickShape(ctx, x + 3, y + 7, w, h + 2, 12, "#132c4796");
  brickShape(ctx, x, y, w, h, 11, brickPaint(ctx, y, y + h, wide ?
    [[0, "#fff7b5"], [0.40, "#ffd372"], [1, "#a45678"]] :
    [[0, "#b9ffff"], [0.34, "#6fe9d4"], [0.64, "#3299a7"], [1, "#356389"]]));
  brickShape(ctx, x + 12, y + 4, w - 24, 4, 2, "#edfff0d6");
  for (const at of [x + 13, x + w - 13]) brickOval(ctx, at, y + h * 0.60, 5.4, 4.2, wide ? "#fff8c8" : "#fcf1a1");
  brickSpark(ctx, x + w / 2, y + h * 0.60, 7.3, wide ? "#fff5ba" : "#c9ffec");
}

function drawBrickBall(ctx, ball, trail, reduced) {
  const { x, y, r } = ball;
  if (!reduced) trail.forEach((point, i) => brickOval(ctx, point.x, point.y, r * (0.26 + i * 0.056), r * (0.26 + i * 0.056), i % 2 ? "#c0fce927" : "#fff5b62b"));
  const halo = ctx.createRadialGradient(x, y, r * 0.44, x, y, r * 1.8);
  halo.addColorStop(0, "#fff7b08c");halo.addColorStop(1, "#fff7b000");
  brickOval(ctx, x, y, r * 1.8, r * 1.8, halo);
  const core = ctx.createRadialGradient(x - r * 0.35, y - r * 0.38, r * 0.08, x, y, r);
  core.addColorStop(0, "#fffef0");core.addColorStop(0.62, "#fff4a5");core.addColorStop(0.88, "#ffb867");core.addColorStop(1, "#bc577a");
  brickOval(ctx, x, y, r, r, core);
  brickOval(ctx, x - 3.9, y - 4.9, 3.9, 2.8, "#fff");
}

function startBrickBonus({ dialog, arena, controls, signal, onProgress, onWin }) {
  const { game, paddle, steer, resize, advance } = createBrickRound();
  const audio = window.SyllabesToonAudio.createArcadeAudio(signal, "bricks");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas"), cabinet = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false }), decor = cabinet.getContext("2d", { alpha: false });
  canvas.className = "brick-bonus-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Terrain du casse-briques");
  arena.append(canvas);
  const music = document.createElement("button");
  music.type = "button";
  music.className = "space-bonus-secondary brick-bonus-music";
  music.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/></svg> Musique';
  controls.append(music);
  let hasMusic = true;
  const toggleMusic = (on) => {
    music.setAttribute("aria-pressed", String(on));
    music.title = on ? "Couper la musique" : "Activer la musique";
    audio.music(on);
  };
  toggleMusic(hasMusic);
  music.addEventListener("click", () => { hasMusic = !hasMusic;toggleMusic(hasMusic); }, { signal });
  dialog.addEventListener("pointerdown", audio.unlock, { signal });
  dialog.addEventListener("keydown", audio.unlock, { signal });

  let view, ratio, frame, last;
  let impact = -2;
  let lastTone = -2;
  const trail = [], particles = [];
  const input = bindBrickControls(dialog, canvas, signal, (x) => {
    if (view && game.phase !== "celebrate") steer((x - canvas.getBoundingClientRect().left - view.x) / view.scale);
  });

  function size() {
    const { width, height } = arena.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    if (width <= 0 || height <= 0 || (view?.width === width && view.height === height && ratio === dpr)) return;
    ratio = dpr;
    input.cancel();
    trail.length = 0;
    particles.length = 0;
    view = brickView(width, height);
    resize(view.fieldWidth, view.fieldHeight);
    canvas.width = cabinet.width = Math.round(width * dpr);
    canvas.height = cabinet.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    decor.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBrickCabinet(decor, view);
    draw();
  }

  function burst(event, count) {
    if (reduce.matches) return;
    for (let i = 0; i < count; i += 1) {
      const id = (event.id ?? 0) + i;
      const angle = i * 2.38 + id * 0.61;
      const speed = 60 + (id * 29 % 140);
      particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 48,
        kind: i % 3, at: game.time, color: brickPalette[id % brickPalette.length][i % 2 ? 0 : 3] });
    }
  }

  function draw() {
    if (!view) return;
    ctx.drawImage(cabinet, 0, 0, view.width, view.height);
    ctx.save();ctx.translate(view.x, view.y);ctx.scale(view.scale, view.scale);
    ctx.beginPath();ctx.roundRect(0, 0, game.width, game.height, 20);ctx.clip();
    for (const brick of game.bricks) if (brick.alive) drawBrickTile(ctx, brick, game.time, reduce.matches);
    for (const star of game.stars) {
      brickOval(ctx, star.x, star.y, 18, 18, "#fff2a641");
      brickSpark(ctx, star.x, star.y, 15, "#ffe688", reduce.matches ? 0 : game.time * 1.9);
      brickSpark(ctx, star.x, star.y, 6.5, "#fffce5", reduce.matches ? 0 : game.time * 1.9);
    }
    if (game.phase === "serve") {
      ctx.beginPath();ctx.arc(game.ball.x, game.ball.y, 21, 0, 2 * Math.PI);
      ctx.strokeStyle = "#fff9c38c";ctx.lineWidth = 2;ctx.stroke();
    }
    drawBrickPaddle(ctx, paddle(), game, impact, reduce.matches);
    if (game.phase === "play" || game.phase === "serve") drawBrickBall(ctx, game.ball, trail, reduce.matches);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const part = particles[i];
      const age = game.time - part.at;
      if (age > 0.95 || reduce.matches) { particles.splice(i, 1);continue; }
      const x = part.x + age * part.vx, y = part.y + age * part.vy + 150 * age * age;
      ctx.globalAlpha = 1 - age / 0.95;
      if (part.kind === 0) brickSpark(ctx, x, y, 7, part.color, age * 3);
      else if (part.kind === 1) brickOval(ctx, x, y, 3.1, 3.1, part.color);
      else {
        ctx.save();ctx.translate(x, y);ctx.rotate(age * 6);
        brickShape(ctx, -5, -2, 10, 4, 2, part.color);ctx.restore();
      }
    }
    ctx.restore();
  }

  const progress = () => onProgress(`Briques : ${game.count}`, brickGoal);
  function tick(now) {
    const dt = last === undefined ? 0 : brickClamp((now - last) / 1000, 0, 0.048);
    last = now;
    if (!document.hidden && view) {
      const direction = input.direction();
      if (direction && game.phase !== "celebrate") steer(game.center + direction * game.width * dt * 0.92);
      for (const event of advance(dt)) {
        if (event.kind === "win") { onWin("Bravo ! Les douze briques sont bris\u00e9es !");return; }
        if (event.kind === "brick" || event.kind === "last") { progress();burst(event, event.kind === "last" ? 27 : 12); }
        if (["star", "miss", "paddle"].includes(event.kind)) burst(event, event.kind === "star" ? 11 : 5);
        if (event.kind === "paddle") impact = game.time;
        if (event.kind === "miss") trail.length = 0;
        if (event.kind === "last") audio.music(false);
        if (event.kind === "fanfare") {
          for (let i = 1; i < 8; i += 1) burst({ x: game.width * i / 8, y: game.height * 0.18, id: i }, 8);
        }
        const spacing = event.kind === "wall" ? 0.12 : ["brick", "paddle"].includes(event.kind) ? 0.065 : 0;
        if (!spacing || game.time - lastTone > spacing) {
          audio.play(`brick-${event.kind}`);
          lastTone = game.time;
        }
      }
      if (!reduce.matches && game.phase === "play") {
        trail.push({ x: game.ball.x, y: game.ball.y });
        if (trail.length > 7) trail.shift();
      }
      draw();
    }
    frame = window.requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(size);
  observer.observe(arena);
  window.addEventListener("blur", input.cancel, { signal });
  document.addEventListener("visibilitychange", () => { last = undefined;input.cancel(); }, { signal });
  signal.addEventListener("abort", () => { observer.disconnect();window.cancelAnimationFrame(frame); }, { once: true });
  size();
  canvas.focus({ preventScroll: true });
  progress();
  frame = window.requestAnimationFrame(tick);
}
