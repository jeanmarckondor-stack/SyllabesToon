const fishingGoal = 4;
const fishingClamp = (v, a, b) => Math.max(a, Math.min(v, b));
const fishingMix = (a, b, t) => a + (b - a) * t;
const fishingSwimmers = [
  [0.22, 0.34, 0.19, 0.51, 0.2, 0.063, 0],
  [0.40, 0.31, 0.35, 0.45, 2.1, 0.067, 1],
  [0.62, 0.34, 0.22, 0.42, 0.8, 0.064, 2],
  [0.78, 0.31, 0.38, 0.37, 3.1, 0.071, 3],
  [0.52, 0.32, 0.17, 0.50, 4.3, 0.057, 4],
  [0.30, 0.21, 0.57, 0.55, 4.6, 0.051, 2],
  [0.67, 0.19, 0.64, 0.57, 1.7, 0.055, 0],
];

const fishingColors = [
  ["#ffe3a4", "#ff8c57", "#c74a5a", "#fff2d0"],
  ["#a5edff", "#58b2ef", "#3058a6", "#ffdb85"],
  ["#fff5b3", "#ffc146", "#dc754e", "#fff0a0"],
  ["#e7c9ff", "#b67cdd", "#70469f", "#ffd893"],
  ["#b5ffc8", "#6bd9a6", "#248b83", "#f8df8c"],
];

function fishingSwim(fish, time) {
  const angle = time * fish.speed + fish.phase;
  return {
    x: 0.5 + fish.range * Math.cos(angle),
    y: fish.depth + Math.sin(time * 0.74 + fish.phase * 1.9) * 0.033,
    direction: -Math.sin(angle),
  };
}

function fishingTarget(view, x, y) {
  return {
    x: fishingClamp(x / view.width, 0.065, 0.935),
    y: fishingClamp((y - view.surface) / view.water, 0.075, 0.89),
  };
}

function fishingContact(h0, h1, f0, f1, rx, ry) {
  // Compare motion relative to a fish, including contact between rendered frames.
  const x = (h0.x - f0.x) / rx;
  const y = (h0.y - f0.y) / ry;
  const dx = (h1.x - f1.x) / rx - x;
  const dy = (h1.y - f1.y) / ry - y;
  const distance = x * x + y * y - 1;
  if (distance <= 0) return 0;
  const speed = dx * dx + dy * dy;
  const dot = x * dx + y * dy;
  const discriminant = dot * dot - speed * distance;
  if (!speed || dot >= 0 || discriminant < 0) return null;
  const at = (-dot - Math.sqrt(discriminant)) / speed;
  return at >= 0 && at <= 1 ? at : null;
}

function createFishingRound() {
  const fish = fishingSwimmers.map(([phase, range, depth, speed, shift, size, art], id) => {
    const piece = { speed, range, depth, phase: phase + shift, size, art, id, status: "swim" };
    return Object.assign(piece, fishingSwim(piece, 0));
  });
  const game = { time: 0, caught: 0, fish, line: null, celebration: 0, won: false };

  function launch(aim, anchor) {
    if (!aim || game.line || game.caught >= fishingGoal) return false;
    game.line = { aim, anchor, x: anchor.x, y: anchor.y, phase: "cast", age: 0 };
    return true;
  }

  function advance(dt, { sx, sy }) {
    const events = [];
    while (dt > 0.00001 && !game.won) {
      const step = Math.min(dt, 1 / 90);
      update(step, sx, sy, events);
      dt -= step;
    }
    return events;
  }

  function update(dt, sx, sy, events) {
    const before = game.time;
    game.time += dt;
    for (const item of fish) {
      if (item.status === "swim") Object.assign(item, fishingSwim(item, game.time));
      if (item.status === "release") {
        const t = fishingClamp((game.time - item.release.time) / 0.94, 0, 1);
        item.x = fishingMix(item.release.x, item.release.to, t);
        item.y = 0.30 * t - Math.sin(Math.PI * t) * 0.12;
        item.direction = Math.sign(item.release.to - item.release.x);
        if (t === 1) item.status = "free";
      }
    }

    const line = game.line;
    if (!line) {
      if (game.caught === fishingGoal && game.time >= game.celebration) {
        game.won = true;
        events.push({ kind: "win" });
      }
      return;
    }
    const previous = { x: line.x, y: line.y };
    line.age += dt;
    switch (line.phase) {
      case "cast": {
        const t = fishingClamp(line.age / 0.36, 0, 1);
        line.x = fishingMix(line.anchor.x, line.aim.x, t);
        line.y = fishingMix(line.anchor.y, 0, t) - Math.sin(t * Math.PI) * 0.12;
        if (t === 1) { line.phase = "sink"; line.age = 0; events.push({ kind: "splash", x: line.x, y: 0 }); }
        return;
      }
      case "sink":
        line.y = Math.min(line.aim.y, line.y + 0.86 * dt);
        if (line.y === line.aim.y) { line.phase = "wait"; line.age = 0; }
        break;
      case "wait":
        line.x = line.aim.x + Math.sin(line.age * 8) * 0.006;
        if (line.age >= 0.37) { line.phase = "rise"; line.age = 0; }
        break;
      case "rise":
        line.y = Math.max(0, line.y - dt * 1.04);
        break;
      case "reel": {
        const t = Math.min(1, line.age / line.reelFor);
        line.x = fishingMix(line.from.x, line.anchor.x, t * t * (3 - 2 * t));
        line.y = fishingMix(line.from.y, 0, t);
        Object.assign(line.fish, { x: line.x, y: line.y + 0.035 });
        if (t === 1) {
          game.caught += 1;
          const item = line.fish;
          const side = line.x > 0.59 ? -1 : 1;
          item.release = { x: line.x, time: game.time, to: fishingClamp(line.x + side * 0.27, 0.1, 0.9) };
          item.status = "release";
          events.push({ kind: "land", x: line.x, y: 0, art: item.art, id: item.id, count: game.caught });
          if (game.caught === fishingGoal) game.celebration = game.time + 1.15;
          game.line = null;
        }
        return;
      }
    }

    let first = null;
    for (const item of fish) {
      if (item.status !== "swim") continue;
      const at = fishingContact(previous, line, fishingSwim(item, before), item,
        0.019 + item.size * sx * 0.78, 0.017 + item.size * sy * 0.49);
      if (at !== null && (!first || at < first.at)) first = { item, at };
    }
    if (first) {
      line.x = fishingMix(previous.x, line.x, first.at);
      line.y = fishingMix(previous.y, line.y, first.at);
      line.from = { x: line.x, y: line.y };
      line.phase = "reel";
      line.age = 0;
      line.reelFor = 0.58 + line.y * 0.48;
      line.fish = first.item;
      Object.assign(first.item, { status: "hooked", x: line.x, y: line.y + 0.035 });
      events.push({ kind: "hook", x: line.x, y: line.y, art: first.item.art, id: first.item.id });
    } else if (line.phase === "rise" && line.y === 0) {
      game.line = null;
      events.push({ kind: "miss" });
    }
  }

  return { game, launch, advance };
}

function fishingView(width, height) {
  const surface = height * (width >= height ? 0.286 : 0.247);
  const unit = Math.min(width, height * 1.43);
  return { width, height, surface, water: height - surface, unit,
    sx: unit / width, sy: unit / (height - surface) };
}

function bindFishingPointer(canvas, { signal, view, canAim, showAim, cast }) {
  let pointer = null;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  function cancel() {
    const active = pointer;
    pointer = null;
    showAim(null);
    if (active !== null && canvas.hasPointerCapture(active)) canvas.releasePointerCapture(active);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointer !== null || !canAim() || !view()) return;
    const { x, y } = point(event);
    const size = view();
    if (y < size.surface) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    showAim(fishingTarget(size, x, y));
  }, { signal });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    const { x, y } = point(event);
    showAim(fishingTarget(view(), x, y));
  }, { signal });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointer) return;
    const { x, y } = point(event);
    const aim = fishingTarget(view(), x, y);
    cancel();
    cast(aim);
  }, { signal });
  for (const name of ["pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(name, (event) => { if (event.pointerId === pointer) cancel(); }, { signal });
  }
  signal.addEventListener("abort", cancel, { once: true });
  return cancel;
}

function fishingOval(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function fishingStroke(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function fishingGradient(ctx, start, end, stops) {
  const paint = ctx.createLinearGradient(0, start, 0, end);
  stops.forEach(([where, color]) => paint.addColorStop(where, color));
  return paint;
}

function drawFishingScenery(ctx, { width: w, height: h, surface: s, water, unit }) {
  ctx.fillStyle = fishingGradient(ctx, 0, s, [[0, "#70c6ef"], [0.65, "#b9effa"], [1, "#fff0ba"]]);
  ctx.fillRect(0, 0, w, s + 1);
  const sun = [w * 0.77, s * 0.38, unit * 0.037];
  const haze = ctx.createRadialGradient(sun[0], sun[1], sun[2] * 0.35, sun[0], sun[1], sun[2] * 2.35);
  haze.addColorStop(0, "#fffcd2a6");
  haze.addColorStop(1, "#fff6b100");
  fishingOval(ctx, sun[0], sun[1], sun[2] * 2.35, sun[2] * 2.35, haze);
  fishingOval(ctx, ...sun, sun[2], "#fff3a0");
  for (const [cx, cy, scale] of [[0.10, 0.26, 0.055], [0.37, 0.17, 0.048], [0.92, 0.17, 0.051]]) {
    const x = w * cx, y = s * cy, r = unit * scale;
    fishingOval(ctx, x, y, r * 1.38, r * 0.24, "#effdfece");
    fishingOval(ctx, x - r * 0.45, y - r * 0.12, r * 0.61, r * 0.26, "#f6feff");
    fishingOval(ctx, x + r * 0.18, y - r * 0.24, r * 0.67, r * 0.32, "#f8ffff");
  }
  for (const [x, length, height, color] of [[0.08, 0.31, 0.25, "#8dcbc9"], [0.52, 0.28, 0.15, "#a4dbcc"],
    [0.88, 0.33, 0.28, "#7eb9ae"], [0.91, 0.24, 0.16, "#5caaa1"]]) {
    const center = x * w, breadth = length * w;
    ctx.beginPath();ctx.moveTo(center - breadth / 2, s);
    ctx.bezierCurveTo(center - breadth * 0.31, s - s * height, center - breadth * 0.27, s - s * height * 1.2, center, s - s * height * 0.60);
    ctx.bezierCurveTo(center + breadth * 0.25, s - s * height * 0.95, center + breadth * 0.40, s - s * height * 0.26, center + breadth / 2, s);
    ctx.closePath();ctx.fillStyle = color;ctx.fill();
  }
  ctx.fillStyle = fishingGradient(ctx, s, h, [[0, "#51d5d3"], [0.28, "#249cac"], [0.63, "#216e9b"], [1, "#24456c"]]);
  ctx.fillRect(0, s, w, water);
  const rays = fishingGradient(ctx, s, h * 0.92, [[0, "#faffb84d"], [0.5, "#c9ffed22"], [1, "#d9fff000"]]);
  for (const [a, b, side] of [[0.10, 0.13, 0.04], [0.26, 0.30, 0.14], [0.55, 0.58, 0.18], [0.72, 0.76, 0.22], [0.87, 0.91, 0.12]]) {
    ctx.beginPath();ctx.moveTo(w * a, s);ctx.lineTo(w * b, s);
    ctx.lineTo(w * (b - side + 0.04), h * 0.88);ctx.lineTo(w * (a - side - 0.08), h * 0.91);
    ctx.closePath();ctx.fillStyle = rays;ctx.fill();
  }
  for (const [y, color] of [[0.91, "#3d7992"], [0.953, "#679da4"], [0.991, "#b8bd9a"]]) {
    ctx.beginPath();ctx.moveTo(0, h * y);
    ctx.bezierCurveTo(w * 0.23, h * (y - 0.09), w * 0.66, h * (y + 0.025), w, h * (y - 0.067));
    ctx.lineTo(w, h);ctx.lineTo(0, h);ctx.closePath();ctx.fillStyle = color;ctx.fill();
  }
  for (let i = 0; i < 25; i += 1) {
    const x = w * ((i * 59 + 7) % 103) / 103;
    const y = h * (0.932 + ((i * 7) % 12) * 0.005);
    fishingOval(ctx, x, y, unit * (0.002 + i % 4 * 0.001), unit * 0.0018, i % 3 ? "#81a5a3" : "#efdbaf");
  }
  for (const [x, y, scale] of [[0.08, 0.943, 0.040], [0.90, 0.928, 0.043], [0.75, 0.954, 0.021], [0.25, 0.959, 0.022]]) {
    const r = unit * scale;
    fishingOval(ctx, x * w, y * h, r * 1.3, r * 0.38, "#354e7666");
    fishingOval(ctx, x * w, y * h - r * 0.35, r, r * 0.68, "#537795");
    fishingOval(ctx, x * w - r * 0.13, y * h - r * 0.58, r * 0.72, r * 0.37, "#709bb0");
    fishingOval(ctx, x * w + r * 0.77, y * h, r * 0.58, r * 0.36, "#635b89");
  }
}

function drawFishingPlants(ctx, view, time, reduced) {
  const { width: w, height: h, unit } = view;
  for (const [x, y, size, color, shine] of [[0.035, 0.947, 0.092, "#208c82", "#79c998"],
    [0.97, 0.93, 0.126, "#287e85", "#72c4ab"], [0.16, 0.96, 0.067, "#743f78", "#df8aa9"],
    [0.83, 0.96, 0.081, "#aa597f", "#f4a491"], [0.55, 0.986, 0.047, "#358f87", "#8bcba4"]]) {
    ctx.save();ctx.translate(w * x, h * y);ctx.scale(unit * size, unit * size);
    for (let j = -2; j <= 2; j += 1) {
      const sway = reduced ? 0 : Math.sin(time * 1.55 + x * 5 + j) * 0.13;
      const top = -1 + Math.abs(j) * 0.115;
      ctx.beginPath();ctx.moveTo(j * 0.08, 0);
      ctx.bezierCurveTo(j * 0.14 - 0.15, -0.37, j * 0.18 + sway - 0.12, top + 0.15, j * 0.25 + sway, top);
      ctx.bezierCurveTo(j * 0.24 + sway + 0.21, top + 0.23, j * 0.15 + 0.15, -0.18, j * 0.08 + 0.06, 0);
      ctx.closePath();ctx.fillStyle = j % 2 ? color : shine;ctx.fill();
    }
    ctx.restore();
  }
  for (const [x, y, scale, coral] of [[0.105, 0.962, 0.067, "#ffad94"], [0.91, 0.948, 0.075, "#d88fb8"], [0.26, 0.970, 0.041, "#f5c776"]]) {
    ctx.save();ctx.translate(w * x, h * y);ctx.scale(unit * scale, unit * scale);
    ctx.beginPath();ctx.moveTo(0, 0);ctx.quadraticCurveTo(-0.18, -0.45, 0, -0.92);
    ctx.moveTo(-0.067, -0.45);ctx.quadraticCurveTo(-0.47, -0.48, -0.48, -0.77);
    ctx.moveTo(-0.055, -0.60);ctx.quadraticCurveTo(0.39, -0.56, 0.43, -0.88);
    fishingStroke(ctx, coral, 0.084);
    ctx.restore();
  }
}

function fishingBoatPose(view, time, target, reduced) {
  const x = view.width * 0.28;
  const scale = view.unit / 795;
  const y = view.surface + (reduced ? 0 : Math.sin(time * 1.55) * scale * 5);
  const facing = target < 0.28 ? -1 : 1;
  const length = 78 + fishingClamp(Math.abs(target - 0.28) * 126, 0, 57);
  const pivot = { x: x + facing * scale * 46, y: y - scale * 31 };
  const tip = { x: pivot.x + facing * scale * length * 0.67, y: pivot.y - scale * (61 - length * 0.095) };
  return { x, y, scale, pivot, tip, facing };
}

function drawFishingBoat(ctx, boat, time, reduced) {
  const { x, y, scale, pivot, tip, facing } = boat;
  fishingOval(ctx, x, y + scale * 26, 118 * scale, 8 * scale, "#167a9460");
  ctx.save();ctx.translate(x, y);ctx.scale(scale, scale);
  ctx.rotate(reduced ? 0 : Math.sin(time * 1.55) * 0.028);
  ctx.beginPath();ctx.moveTo(-96, -12);ctx.quadraticCurveTo(-28, -19, 104, -13);
  ctx.quadraticCurveTo(89, 19, 59, 27);ctx.quadraticCurveTo(-4, 39, -75, 17);
  ctx.quadraticCurveTo(-91, 14, -96, -12);ctx.closePath();
  ctx.fillStyle = fishingGradient(ctx, -14, 35, [[0, "#fff4ab"], [0.22, "#ffb96b"], [0.55, "#e76d5c"], [1, "#9d426c"]]);
  ctx.fill();fishingStroke(ctx, "#8e5461", 2.6);
  ctx.beginPath();ctx.moveTo(-85, 8);ctx.quadraticCurveTo(-1, 31, 81, 12);fishingStroke(ctx, "#8ce4de", 7);
  ctx.beginPath();ctx.moveTo(-91, -12);ctx.quadraticCurveTo(-17, -15, 100, -12);fishingStroke(ctx, "#ffedb0", 6);
  ctx.beginPath();ctx.roundRect(-65, -52, 84, 36, 11);
  ctx.fillStyle = fishingGradient(ctx, -52, -14, [[0, "#fffad7"], [1, "#eab976"]]);ctx.fill();fishingStroke(ctx, "#9f6359", 2);
  for (const wx of [-55, -20]) {
    ctx.beginPath();ctx.roundRect(wx, -45, 27, 19, 6);ctx.fillStyle = "#3f7791";ctx.fill();
    ctx.beginPath();ctx.moveTo(wx + 5, -39);ctx.lineTo(wx + 15, -42);fishingStroke(ctx, "#b3eff0", 2);
  }
  ctx.beginPath();ctx.moveTo(-72, -50);ctx.quadraticCurveTo(-49, -75, -20, -65);ctx.quadraticCurveTo(-2, -61, 25, -52);
  ctx.lineTo(19, -47);ctx.lineTo(-69, -46);ctx.closePath();ctx.fillStyle = "#f67566";ctx.fill();fishingStroke(ctx, "#a35064", 2);
  ctx.beginPath();ctx.moveTo(-43, -64);ctx.lineTo(-43, -114);fishingStroke(ctx, "#8f5c59", 4);
  ctx.beginPath();ctx.moveTo(-42, -112);ctx.quadraticCurveTo(-17, -124, 3, -106);
  ctx.quadraticCurveTo(-24, -107, -42, -96);ctx.closePath();ctx.fillStyle = "#ffcd68";ctx.fill();
  fishingOval(ctx, 47, 1, 11, 11, "#fff4d2");
  fishingOval(ctx, 47, 1, 6, 6, "#d66e64");
  ctx.restore();
  ctx.beginPath();ctx.moveTo(pivot.x, pivot.y);
  ctx.quadraticCurveTo(fishingMix(pivot.x, tip.x, 0.61), tip.y - 8 * scale, tip.x, tip.y);
  fishingStroke(ctx, "#38536b", Math.max(2, 4.8 * scale));
  ctx.beginPath();ctx.moveTo(pivot.x - facing * 7 * scale, pivot.y + 7 * scale);ctx.lineTo(pivot.x, pivot.y);
  fishingStroke(ctx, "#e39459", 7 * scale);
}

function drawFishingFish(ctx, item, view, time, reduced) {
  const { width, surface, water, unit } = view;
  const [light, base, shade, marked] = fishingColors[item.art];
  const x = item.x * width, y = surface + item.y * water;
  const size = item.size * unit;
  const folding = item.status === "free" ? 0 : item.status === "release" ? 1 - fishingClamp((time - item.release.time - 0.52) / 0.42, 0, 1) : 1;
  const flat = item.art === 2 ? 1.26 : item.art === 1 ? 0.88 : 1;
  const turn = Math.sign(item.direction) || 1;
  const squeeze = 0.22 + Math.min(0.78, Math.abs(item.direction) * 3.6);
  const tail = reduced ? 0 : Math.sin(time * (item.status === "hooked" ? 16 : 8.5) + item.id * 1.4) * 0.11;
  ctx.save();ctx.translate(x, y);
  ctx.scale(size * squeeze * turn, size * flat);
  ctx.globalAlpha = folding;
  if (item.status === "hooked") ctx.rotate(-0.19 * turn);
  ctx.beginPath();ctx.moveTo(-0.62, -0.03);ctx.quadraticCurveTo(-0.89, -0.38 - tail, -1.23, -0.38 - tail);
  ctx.quadraticCurveTo(-1.13, -0.02, -1.23, 0.39 + tail);ctx.quadraticCurveTo(-0.91, 0.39 + tail, -0.62, 0.10);
  ctx.closePath();ctx.fillStyle = fishingGradient(ctx, -0.44, 0.37, [[0, light], [0.48, base], [1, shade]]);ctx.fill();
  ctx.beginPath();ctx.moveTo(-0.52, -0.31);ctx.quadraticCurveTo(-0.53, -0.63, -0.20, -0.57);
  ctx.quadraticCurveTo(0.03, -0.73, 0.24, -0.40);ctx.closePath();ctx.fillStyle = light;ctx.fill();
  ctx.beginPath();ctx.moveTo(-0.70, -0.13);ctx.bezierCurveTo(-0.46, -0.62, 0.38, -0.65, 0.69, -0.24);
  ctx.bezierCurveTo(1.02, 0.17, 0.51, 0.51, 0.10, 0.46);ctx.bezierCurveTo(-0.42, 0.48, -0.67, 0.30, -0.70, -0.13);ctx.closePath();
  const body = fishingGradient(ctx, -0.57, 0.48, [[0, light], [0.44, base], [1, shade]]);
  ctx.fillStyle = body;ctx.fill();fishingStroke(ctx, shade, 0.035);
  ctx.save();ctx.clip();
  if (item.art === 0 || item.art === 3) {
    ctx.beginPath();ctx.moveTo(-0.48, -0.57);ctx.bezierCurveTo(-0.64, -0.14, -0.34, 0.25, -0.48, 0.49);
    ctx.moveTo(-0.19, -0.57);ctx.bezierCurveTo(-0.40, -0.14, -0.06, 0.24, -0.19, 0.52);
    fishingStroke(ctx, marked, item.art === 0 ? 0.103 : 0.055);
  } else {
    for (const [dx, dy, r] of [[-0.49, -0.16, 0.063], [-0.30, -0.26, 0.073], [-0.36, 0.09, 0.051], [-0.17, -0.09, 0.038]]) {
      fishingOval(ctx, dx, dy, r, r * 0.70, marked);
    }
  }
  ctx.restore();
  ctx.beginPath();ctx.moveTo(-0.04, -0.14);ctx.quadraticCurveTo(-0.42, 0.02, -0.22, 0.29 + tail);
  ctx.quadraticCurveTo(0.09, 0.26 + tail, 0.14, 0.01);ctx.closePath();ctx.fillStyle = light;ctx.fill();fishingStroke(ctx, shade, 0.026);
  ctx.beginPath();ctx.moveTo(-0.06, -0.32);ctx.quadraticCurveTo(0.09, -0.43, 0.31, -0.32);fishingStroke(ctx, "#ffffffb0", 0.055);
  const surprised = item.status === "hooked";
  const blink = !surprised && !reduced && (time + item.id * 0.67) % 6.2 > 6.04;
  fishingOval(ctx, 0.43, -0.105, 0.209, blink ? 0.035 : surprised ? 0.247 : 0.212, "#fff9e7");
  if (!blink) {
    fishingOval(ctx, surprised ? 0.42 : 0.48, -0.10, 0.098, 0.118, "#203650");
    fishingOval(ctx, surprised ? 0.395 : 0.455, -0.145, 0.034, 0.04, "#fff");
  }
  fishingOval(ctx, 0.36, 0.17, 0.085, 0.043, "#ffafa1");
  if (surprised) fishingOval(ctx, 0.64, 0.155, 0.072, 0.093, "#713e58");
  else {
    ctx.beginPath();ctx.moveTo(0.53, 0.17);ctx.quadraticCurveTo(0.66, 0.29, 0.73, 0.15);fishingStroke(ctx, "#713e58", 0.04);
  }
  ctx.restore();
}

function drawFishingWater(ctx, view, motion, reduced) {
  const { width: w, surface: y, water, unit } = view;
  const clock = reduced ? 0 : motion;
  ctx.beginPath();ctx.moveTo(0, y);
  for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, y + Math.sin(x / 54 - clock * 2) * 3.1);
  fishingStroke(ctx, "#d7ffec", 2.7);
  for (let i = 0; i < 13; i += 1) {
    const x = w * ((i * 29 + 4) % 100) / 100;
    const dy = y + unit * (0.012 + (i % 4) * 0.010);
    const length = unit * ((i % 3 + 1) * 0.015 + (i % 5 === 1 ? 0.038 : 0));
    ctx.beginPath();ctx.moveTo(x, dy);
    ctx.quadraticCurveTo(x + length / 2, dy + 1.8 * Math.sin(clock * 2 + i), x + length, dy - 1);
    fishingStroke(ctx, i % 4 ? "#d9ffda72" : "#fff6bbad", 1.6);
  }
  for (let i = 0; i < 21; i += 1) {
    const life = ((i * 47 % 101) / 101 + clock * (0.020 + i % 4 * 0.005)) % 1;
    const x = (i * 73 % 103) / 103 * w + Math.sin(clock * 1.3 + i) * unit * 0.008;
    const radius = unit * (0.0025 + i % 5 * 0.0012);
    const bubble = y + water * (1 - life) * 0.95;
    ctx.beginPath();ctx.arc(x, bubble, radius, 0, Math.PI * 2);
    fishingStroke(ctx, "#d5fffa60", 1.15);
    fishingOval(ctx, x - radius * 0.30, bubble - radius * 0.39, radius * 0.29, radius * 0.18, "#ebffed9c");
  }
}

function drawFishingLine(ctx, view, boat, line, aim) {
  if (!line && !aim) return;
  const { width, surface, water, unit } = view;
  const target = line || aim;
  const x = target.x * width, y = surface + target.y * water;
  const edge = line ? Math.min(surface, y) : surface;
  ctx.beginPath();ctx.moveTo(boat.tip.x, boat.tip.y);
  ctx.quadraticCurveTo(fishingMix(boat.tip.x, x, 0.71), edge - unit * 0.022, x, edge);
  if (y > edge) ctx.lineTo(x, y);
  if (aim) ctx.setLineDash([5, 5]);
  fishingStroke(ctx, "#1b436b96", line ? 4 : 3);
  fishingStroke(ctx, line ? "#f8fff0" : "#fff5b2", line ? 1.8 : 1.4);
  ctx.setLineDash([]);
  const r = Math.max(line ? 7 : 13, unit * (line ? 0.011 : 0.017));
  if (aim) {
    ctx.beginPath();ctx.arc(x, y, r, 0, 2 * Math.PI);fishingStroke(ctx, "#27536b", 5);
    fishingStroke(ctx, "#ffe99e", 2);
    fishingOval(ctx, x, y, 3, 3, "#fff7cc");
  } else {
    ctx.beginPath();ctx.moveTo(x, y - r * 0.56);ctx.lineTo(x, y + r * 0.18);
    ctx.bezierCurveTo(x, y + r, x + r * 0.86, y + r * 0.72, x + r * 0.72, y);
    fishingStroke(ctx, "#234363", 4.2);fishingStroke(ctx, "#f9ffe7", 2.3);
    fishingOval(ctx, x, y - r * 0.68, r * 0.37, r * 0.48, "#ffac73");
  }
}

function drawFishingEffects(ctx, view, game, effects, reduced) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    const t = (game.time - effect.time) / (effect.kind === "land" ? 0.85 : 0.47);
    if (t >= 1) { effects.splice(i, 1);continue; }
    const x = effect.x * view.width, y = view.surface + effect.y * view.water;
    const radius = Math.max(9, view.unit * 0.013);
    const [light, base, , accent] = fishingColors[effect.art ?? 1];
    ctx.save();ctx.globalAlpha = 1 - t;
    ctx.beginPath();ctx.ellipse(x, y + 2, radius * (1 + (reduced ? 0 : t) * 2.4), radius * 0.34, 0, 0, Math.PI * 2);
    fishingStroke(ctx, light, 3);
    if (!reduced && effect.kind !== "splash") {
      for (let j = 0; j < 8; j += 1) {
        const a = (j * 0.78) - 1.4;
        const xx = x + Math.cos(a) * radius * t * 3.8;
        const yy = y + (Math.sin(a) - 0.4) * radius * t * 3.1;
        const r = radius * (0.12 + j % 3 * 0.045);
        if (j % 3) fishingOval(ctx, xx, yy, r, r * 1.35, j % 2 ? light : base);
        else {
          ctx.beginPath();ctx.moveTo(xx - r, yy);ctx.lineTo(xx + r, yy);
          ctx.moveTo(xx, yy - r);ctx.lineTo(xx, yy + r);fishingStroke(ctx, accent, 2.6);
        }
      }
    }
    ctx.restore();
  }
}

function startFishingBonus({ arena, controls, signal, onProgress, onWin }) {
  const { game, launch, advance } = createFishingRound();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  const scenery = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const decor = scenery.getContext("2d", { alpha: false });
  canvas.className = "fishing-bonus-canvas";
  canvas.setAttribute("aria-label", "Mer et poissons à attraper");
  arena.append(canvas);

  const sound = document.createElement("button");
  sound.type = "button";
  sound.className = "space-bonus-secondary fishing-bonus-sound";
  sound.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/></svg> Son';
  sound.title = "Activer ou couper le son";
  sound.setAttribute("aria-pressed", "false");
  controls.append(sound);
  let audio;
  let soundEnabled = false;
  sound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    sound.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) {
      audio ??= window.SyllabesToonAudio.createArcadeAudio(signal, "fishing");
      audio.music(true);
    } else {
      audio.stopEffects();
      audio.music(false);
    }
  }, { signal });
  const play = (event) => { if (soundEnabled) audio.play(event); };

  let view;
  let ratio;
  let aim;
  let frame;
  let last;
  const effects = [];
  const stopAim = bindFishingPointer(canvas, {
    signal,
    view: () => view,
    canAim: () => !game.line && game.caught < fishingGoal,
    showAim: (point) => { aim = point; canvas.classList.toggle("is-aiming", Boolean(point)); },
    cast: (point) => {
      const { tip } = fishingBoatPose(view, game.time, point.x, reduced.matches);
      if (launch(point, { x: tip.x / view.width, y: (tip.y - view.surface) / view.water })) play("fish-cast");
    },
  });

  function size() {
    const { width, height } = arena.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    if (width <= 0 || height <= 0 || (view?.width === width && view.height === height && ratio === dpr)) return;
    stopAim();
    ratio = dpr;
    view = fishingView(width, height);
    canvas.width = scenery.width = Math.round(width * dpr);
    canvas.height = scenery.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    decor.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFishingScenery(decor, view);
    draw();
  }

  function draw() {
    if (!view) return;
    const calm = reduced.matches;
    ctx.drawImage(scenery, 0, 0, view.width, view.height);
    drawFishingWater(ctx, view, game.time, calm);
    drawFishingPlants(ctx, view, game.time, calm);
    for (const fish of game.fish) if (fish.status !== "free") drawFishingFish(ctx, fish, view, game.time, calm);
    const boat = fishingBoatPose(view, game.time, (game.line?.aim ?? aim)?.x ?? 0.61, calm);
    drawFishingLine(ctx, view, boat, game.line, aim);
    drawFishingBoat(ctx, boat, game.time, calm);
    drawFishingEffects(ctx, view, game, effects, calm);
  }

  function progress() { onProgress(`Poissons : ${game.caught}`, fishingGoal); }
  function tick(now) {
    const dt = last === undefined ? 0 : Math.max(0, Math.min(0.055, (now - last) / 1000));
    last = now;
    if (!document.hidden && view) {
      for (const event of advance(dt, view)) {
        if (event.kind === "win") { onWin("Bravo ! Quatre poissons attrapés et relâchés !");return; }
        if (event.kind === "land") {
          progress();
          play(event.count === fishingGoal ? "fish-win" : "fish-land");
        } else if (event.kind === "hook") play("fish-hook");
        if (event.kind !== "miss") effects.push({ ...event, time: game.time });
      }
      draw();
    }
    frame = window.requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(size);
  observer.observe(arena);
  window.addEventListener("blur", stopAim, { signal });
  document.addEventListener("visibilitychange", () => { last = undefined;stopAim(); }, { signal });
  signal.addEventListener("abort", () => {
    observer.disconnect();
    window.cancelAnimationFrame(frame);
  }, { once: true });
  progress();
  size();
  frame = window.requestAnimationFrame(tick);
}
