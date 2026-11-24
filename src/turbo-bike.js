const turboRoad = {
  halfWidth: 1.72,
  speed: 31,
  center: (z) => 1.48 * Math.sin(z * 0.022) + 0.58 * Math.sin(z * 0.041),
  pickup(index) {
    const z = 54 + index * 68;
    const lanes = [-0.55, 0.54, -0.35, 0.65, 0, -0.62];
    return { z, x: this.center(z) + lanes[index % lanes.length] };
  },
};

function advanceTurboRide(ride, dt, direction) {
  ride.x = Math.max(-5, Math.min(5, ride.x + direction * 2.9 * dt));
  const onRoad = Math.abs(ride.x - turboRoad.center(ride.z)) <= turboRoad.halfWidth;
  const targetSpeed = turboRoad.speed * (onRoad ? 1 : 0.63);
  ride.speed += (targetSpeed - ride.speed) * (1 - Math.exp(-3 * dt));
  ride.z += ride.speed * dt;
  ride.lean += (direction - ride.lean) * (1 - Math.exp(-10 * dt));
  ride.spark = Math.max(0, ride.spark - dt);

  const star = turboRoad.pickup(ride.next);
  if (ride.z < star.z) return false;
  ride.next += 1;
  if (Math.abs(ride.x - star.x) > 0.85) return false;
  ride.caught += 1;
  ride.spark = 0.52;
  return true;
}

function startTurboBike({ dialog, arena, controls, signal, onProgress, onWin }) {
  const goal = 6;
  const canvas = document.createElement("canvas");
  canvas.className = "turbo-bike-canvas";
  canvas.setAttribute("aria-hidden", "true");
  arena.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  const pad = document.createElement("div");
  pad.className = "turbo-bike-pad";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", "Direction du vélo");
  controls.append(pad);
  const buttons = [-1, 1].map((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "space-bonus-primary";
    button.dataset.steer = direction < 0 ? "left" : "right";
    button.setAttribute("aria-keyshortcuts", direction < 0 ? "ArrowLeft" : "ArrowRight");
    button.innerHTML = direction < 0 ? '<span aria-hidden="true">&#8592;</span> GAUCHE' : 'DROITE <span aria-hidden="true">&#8594;</span>';
    pad.append(button);
    return button;
  });
  const view = { width: 0, height: 0 };
  const ride = { x: 0, z: 0, speed: turboRoad.speed, lean: 0, spark: 0, caught: 0, next: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let steering = null;
  let frame;
  let lastFrame;

  function steer(button, direction, pointer = null) {
    if (steering) return;
    steering = { button, direction, pointer };
    button.classList.add("is-steering");
    if (pointer !== null) button.setPointerCapture(pointer);
  }

  function release() {
    if (!steering) return;
    const { button, pointer } = steering;
    steering = null;
    button.classList.remove("is-steering");
    if (pointer !== null && button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
  }

  for (const [index, button] of buttons.entries()) {
    button.addEventListener("pointerdown", (event) => {
      if (event.button === 0) steer(button, index === 0 ? -1 : 1, event.pointerId);
    }, { signal });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(eventName, (event) => {
        if (steering?.pointer === event.pointerId) release();
      }, { signal });
    }
  }
  const keys = ["ArrowLeft", "ArrowRight"];
  dialog.addEventListener("keydown", (event) => {
    const index = keys.indexOf(event.key);
    if (index === -1) return;
    event.preventDefault();
    if (!event.repeat) steer(buttons[index], index === 0 ? -1 : 1);
  }, { signal });
  window.addEventListener("keyup", (event) => {
    if (steering?.pointer === null && steering.button === buttons[keys.indexOf(event.key)]) release();
  }, { signal });
  window.addEventListener("blur", release, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) release();
  }, { signal });

  function measure() {
    const { clientWidth: width, clientHeight: height } = arena;
    if (!width || !height || (view.width === width && view.height === height)) return;
    release();
    view.width = width;
    view.height = height;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    drawTurboRide(ctx, view, ride, reducedMotion.matches);
  }

  function tick(now) {
    const dt = lastFrame === undefined ? 0 : Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const collected = advanceTurboRide(ride, dt, steering?.direction ?? 0);
    drawTurboRide(ctx, view, ride, reducedMotion.matches);
    if (collected) {
      onProgress(ride.caught, goal);
      window.SyllabesToonAudio.playProgressChime();
      if (ride.caught === goal) {
        onWin("Bravo ! Six étoiles en poche !");
        return;
      }
    }
    frame = window.requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(measure);
  signal.addEventListener("abort", () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    release();
    for (const button of buttons) button.disabled = true;
  }, { once: true });
  measure();
  observer.observe(arena);
  onProgress(0, goal);
  buttons[0].focus({ preventScroll: true });
  frame = window.requestAnimationFrame(tick);
}

function drawTurboRide(ctx, { width: w, height: h }, ride, reducedMotion) {
  if (!w || !h) return;
  const horizon = h * 0.28;
  const ground = h * 0.94;
  const camera = ride.x * 0.74;
  const unit = Math.min(w * 0.147, h * 0.34);
  const viewDistance = 216;
  const shoulder = turboRoad.halfWidth + 0.13;
  const scaleAt = (depth) => 18 / (18 + depth);
  const project = (depth, x) => {
    const p = scaleAt(depth);
    return { x: w / 2 + (x - camera) * unit * p, y: horizon + (ground - horizon) * p, p };
  };
  const roadPoints = [];
  for (let d = viewDistance; d >= 0; d -= 4) {
    roadPoints.push(project(d, turboRoad.center(ride.z + d)));
  }
  roadPoints.push(project(-2, turboRoad.center(ride.z - 2)));

  function ribbon(points, left, right, color) {
    ctx.beginPath();
    for (const [i, p] of points.entries()) {
      const x = p.x + left * unit * p.p;
      if (i === 0) ctx.moveTo(x, p.y);
      else ctx.lineTo(x, p.y);
    }
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const p = points[i];
      ctx.lineTo(p.x + right * unit * p.p, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  const floor = roadPoints[0].y;
  ctx.fillStyle = "#b5eaf3";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camera * w * 0.008, 0);
  for (const [x, y, size] of [[0.18, 0.13, 0.064], [0.73, 0.09, 0.049]]) {
    const r = size * Math.min(w, h * 1.5);
    turboOval(ctx, w * x, h * y, r, r * 0.23, "#f7fcf5");
    turboOval(ctx, w * x - r * 0.16, h * y - r * 0.14, r * 0.46, r * 0.28, "#f7fcf5");
  }
  for (const [ridge, color] of [[0.14, "#9bd58f"], [0.23, "#70b78d"]]) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, floor);
    ctx.bezierCurveTo(w * 0.18, h * (ridge - 0.08), w * 0.37, h * (ridge + 0.17), w * 0.55, h * (ridge + 0.01));
    ctx.bezierCurveTo(w * 0.73, h * (ridge - 0.11), w * 0.95, h * (ridge + 0.04), w * 1.12, floor);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#8aca63";
  ctx.fillRect(0, floor, w, h - floor);

  for (let z = Math.floor((ride.z + viewDistance) / 9) * 9; z + 9 > ride.z; z -= 9) {
    if (Math.round(z / 9) % 2) continue;
    const far = project(Math.min(viewDistance, z + 9 - ride.z), 0).y;
    const near = project(Math.max(0, z - ride.z), 0).y;
    ctx.fillStyle = "#80c35d";
    ctx.fillRect(0, far, w, near - far);
  }
  ribbon(roadPoints, -shoulder, shoulder, "#f4d995");
  ribbon(roadPoints, -turboRoad.halfWidth, turboRoad.halfWidth, "#4f5873");
  ribbon(roadPoints, -1.62, -1.58, "#eceddb");
  ribbon(roadPoints, 1.58, 1.62, "#eceddb");
  for (let z = Math.floor((ride.z + viewDistance) / 14) * 14; z + 6 > ride.z; z -= 14) {
    const far = Math.min(viewDistance, z + 6 - ride.z);
    const near = Math.max(0, z - ride.z);
    ribbon([project(far, turboRoad.center(ride.z + far)), project(near, turboRoad.center(ride.z + near))], -0.045, 0.045, "#faf0c0");
  }
  // A fixed roadside pattern and a short view distance keep the scene bounded.
  for (let i = Math.floor((ride.z + viewDistance) / 12); i * 12 >= ride.z; i -= 1) {
    const z = i * 12;
    const side = i % 2 === 0 ? -1 : 1;
    const { x, y, p } = project(z - ride.z, turboRoad.center(z) + side * (2.35 + (i % 3) * 0.53));
    turboTree(ctx, x, y, Math.min(h * 0.23, w * 0.34) * p, i % 3 === 0);
  }
  for (let i = ride.next + 3; i >= ride.next; i -= 1) {
    const star = turboRoad.pickup(i);
    const depth = star.z - ride.z;
    if (depth < 0 || depth > viewDistance) continue;
    const { x, y, p } = project(depth, star.x);
    const radius = Math.max(8, Math.min(32, unit * 0.24) * p + 3);
    turboOval(ctx, x, y, radius * 0.7, radius * 0.19, "#25253670");
    turboStar(ctx, x, y - radius * 1.18, radius);
  }
  const rider = project(0, ride.x);
  const size = Math.min(h * 0.235, w * 0.29, 146);
  turboCyclist(ctx, rider.x, rider.y, size, ride, reducedMotion);
  if (ride.spark && !reducedMotion) {
    const spread = (0.52 - ride.spark) * size;
    ctx.globalAlpha = Math.min(1, ride.spark * 4);
    turboStar(ctx, rider.x - size * 0.36 - spread, rider.y - size * 0.62 - spread, size * 0.11);
    turboStar(ctx, rider.x + size * 0.4 + spread, rider.y - size * 0.51 - spread * 0.75, size * 0.08);
    ctx.globalAlpha = 1;
  }
}

function turboOval(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function turboStar(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const r = radius * (i % 2 ? 0.48 : 1);
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffdc4d";
  ctx.strokeStyle = "#85421d";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.stroke();
  ctx.fill();
  turboOval(ctx, x - radius * 0.18, y - radius * 0.12, radius * 0.13, radius * 0.18, "#fff6b1");
}

function turboTree(ctx, x, y, size, light) {
  turboOval(ctx, x, y, size * 0.33, size * 0.09, "#47764d58");
  ctx.fillStyle = "#8b603d";
  ctx.fillRect(x - size * 0.045, y - size * 0.56, size * 0.09, size * 0.56);
  turboOval(ctx, x, y - size * 0.57, size * 0.34, size * 0.31, light ? "#398e58" : "#237757");
  turboOval(ctx, x - size * 0.11, y - size * 0.74, size * 0.21, size * 0.25, light ? "#6bbd58" : "#50a760");
  turboOval(ctx, x + size * 0.14, y - size * 0.68, size * 0.17, size * 0.21, light ? "#77c45f" : "#368f59");
}

function turboCyclist(ctx, x, y, size, ride, reduce) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  turboOval(ctx, 0, 0, 33, 8, "#19303d70");
  ctx.rotate(ride.lean * 0.13);
  const line = (color, width, ...points) => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  turboOval(ctx, 0, -17, 9, 21, "#242943");
  turboOval(ctx, 0, -17, 4, 16, "#627693");
  line("#52dfd0", 6, 0, -18, 0, -45, 16, -55);
  line("#202b45", 7, -26, -54, -18, -58, 18, -58, 26, -54);
  const phase = reduce ? 0 : ride.z * 0.43;
  for (const side of [-1, 1]) {
    const pedal = Math.sin(phase) * side;
    const footY = -15 + pedal * 10;
    line("#293859", 11, side * 10, -41, side * (19 + pedal * 3), -28 - pedal * 4, side * 14, footY);
    line("#fff0c2", 8, side * 14, footY, side * 20, footY + 1);
    line("#c76e55", 8, side * 11, -66, side * 22, -60, side * 26, -54);
  }
  turboOval(ctx, 0, -57, 17, 19, "#9d344c");
  turboOval(ctx, 0, -61, 16, 15, "#f66a60");
  line("#ffe3ac", 4, -13, -59, 13, -59);
  turboOval(ctx, 0, -80, 19, 16, "#984923");
  turboOval(ctx, 0, -83, 19, 14, "#ffd451");
  line("#fff3ad", 4, -8, -90, 3, -94, 11, -91);
  line("#ee9340", 3.5, -17, -80, 0, -77, 17, -80);
  ctx.restore();
}
