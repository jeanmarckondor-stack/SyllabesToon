const turboRoad = {
  halfWidth: 1.92,
  speed: 29,
  center: (z) => 1.95 * Math.sin(z * 0.02) + 1.04 * Math.sin(z * 0.034) + 0.34 * Math.sin(z * 0.061),
  pickup(index) {
    const z = 54 + index * 68;
    const lanes = [-0.55, 0.54, -0.35, 0.65, 0, -0.62];
    return { z, x: this.center(z) + lanes[index % lanes.length] };
  },
};

function steerTurboRide(ride, distance) {
  ride.x = Math.max(-5, Math.min(5, ride.x + distance));
}

function turboDirection(offset, width) {
  return offset < width / 2 ? -1 : 1;
}

function advanceTurboRide(ride, dt, direction) {
  steerTurboRide(ride, direction * 3.27 * dt);
  const onRoad = Math.abs(ride.x - turboRoad.center(ride.z)) <= turboRoad.halfWidth;
  const targetSpeed = turboRoad.speed * (onRoad ? 1 : 0.63);
  ride.speed += (targetSpeed - ride.speed) * (1 - Math.exp(-3 * dt));
  ride.z += ride.speed * dt;
  ride.lean += (direction - ride.lean) * (1 - Math.exp(-10 * dt));
  ride.spark = Math.max(0, ride.spark - dt);

  const star = turboRoad.pickup(ride.next);
  if (ride.z < star.z) return false;
  ride.next += 1;
  if (Math.abs(ride.x - star.x) > 0.94) return false;
  ride.caught += 1;
  ride.spark = 0.52;
  return true;
}

function startTurboBike({ dialog, arena, signal, onProgress, onWin }) {
  const goal = 6;
  const canvas = document.createElement("canvas");
  canvas.className = "turbo-bike-canvas";
  canvas.setAttribute("aria-hidden", "true");
  arena.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  const guides = document.createElement("div");
  guides.className = "turbo-bike-guides";
  guides.setAttribute("aria-hidden", "true");
  guides.innerHTML = "<span>&#8249;</span><span>&#8250;</span>";
  arena.append(guides);
  const view = { width: 0, height: 0 };
  const ride = { x: 0, z: 0, speed: turboRoad.speed, lean: 0, spark: 0, caught: 0, next: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let steering = null;
  let frame;
  let lastFrame;

  function steer(direction, pointer = null) {
    if (steering) return;
    steering = { direction, pointer };
    steerTurboRide(ride, direction * 0.11);
    guides.hidden = true;
    if (pointer !== null) arena.setPointerCapture(pointer);
  }

  function release() {
    if (!steering) return;
    const { pointer } = steering;
    steering = null;
    if (pointer !== null && arena.hasPointerCapture(pointer)) arena.releasePointerCapture(pointer);
  }

  const pointerDirection = (event) => {
    const bounds = arena.getBoundingClientRect();
    return turboDirection(event.clientX - bounds.left, bounds.width);
  };
  arena.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && !event.target.closest("button, a")) steer(pointerDirection(event), event.pointerId);
  }, { signal });
  window.addEventListener("pointermove", (event) => {
    if (steering?.pointer !== event.pointerId) return;
    if (event.pointerType === "mouse" && !(event.buttons & 1)) release();
    else steering.direction = pointerDirection(event);
  }, { signal });
  for (const eventName of ["pointerup", "pointercancel"]) {
    window.addEventListener(eventName, (event) => {
      if (steering?.pointer === event.pointerId) release();
    }, { signal });
  }
  const keys = ["ArrowLeft", "ArrowRight"];
  dialog.addEventListener("keydown", (event) => {
    const index = keys.indexOf(event.key);
    if (index === -1) return;
    event.preventDefault();
    if (!event.repeat) steer(index === 0 ? -1 : 1);
  }, { signal });
  window.addEventListener("keyup", (event) => {
    const index = keys.indexOf(event.key);
    if (index !== -1 && steering?.pointer === null && steering.direction === (index === 0 ? -1 : 1)) release();
  }, { signal });
  window.addEventListener("blur", release, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) release();
    else lastFrame = undefined;
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
  }, { once: true });
  measure();
  observer.observe(arena);
  onProgress(0, goal);
  dialog.querySelector("#spaceBonusQuit").focus({ preventScroll: true });
  frame = window.requestAnimationFrame(tick);
}

function drawTurboRide(ctx, { width: w, height: h }, ride, reducedMotion) {
  if (!w || !h) return;
  const horizon = h * 0.27;
  const ground = h * 0.94;
  const camera = ride.x * 0.74;
  const unit = Math.min(w * 0.152, h * 0.36);
  const viewDistance = 216;
  const shoulder = turboRoad.halfWidth + 0.23;
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
  ctx.fillStyle = turboGradient(ctx, 0, floor, "#70bdda", "#e6f3c2");
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camera * w * 0.008 - Math.sin(ride.z * 0.002) * w * 0.025, 0);
  for (const [x, y, size] of [[0.15, 0.12, 0.068], [0.49, 0.066, 0.039], [0.79, 0.135, 0.078]]) {
    const r = size * Math.min(w, h * 1.5);
    turboOval(ctx, w * x + r * 0.06, h * y + r * 0.071, r, r * 0.22, "#b9d9d7");
    turboOval(ctx, w * x, h * y, r, r * 0.24, "#fcf9df");
    turboOval(ctx, w * x - r * 0.14, h * y - r * 0.16, r * 0.48, r * 0.3, "#fffbee");
    turboOval(ctx, w * x + r * 0.35, h * y - r * 0.075, r * 0.34, r * 0.21, "#fcf9df");
  }
  ctx.restore();
  for (const [ridge, light, dark, depth] of [[0.115, "#a1cd9d", "#79b49c", 1], [0.177, "#95bf72", "#6fa681", 2], [0.237, "#84b95c", "#548f73", 3]]) {
    ctx.save();
    ctx.translate(-camera * w * (0.004 + depth * 0.008), 0);
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, floor);
    ctx.bezierCurveTo(w * 0.18, h * (ridge - 0.08), w * 0.37, h * (ridge + 0.17), w * 0.55, h * (ridge + 0.01));
    ctx.bezierCurveTo(w * 0.73, h * (ridge - 0.11), w * 0.95, h * (ridge + 0.04), w * 1.12, floor);
    ctx.closePath();
    ctx.fillStyle = turboGradient(ctx, h * ridge, floor, light, dark);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = turboGradient(ctx, floor, h, "#acd173", "#71ab55");
  ctx.fillRect(0, floor, w, h - floor);

  for (let z = Math.floor((ride.z + viewDistance) / 9) * 9; z + 9 > ride.z; z -= 9) {
    if (Math.round(z / 9) % 2) continue;
    const far = project(Math.min(viewDistance, z + 9 - ride.z), 0).y;
    const near = project(Math.max(0, z - ride.z), 0).y;
    ctx.fillStyle = "#3e87541a";
    ctx.fillRect(0, far, w, near - far);
  }
  ribbon(roadPoints, -shoulder - 0.11, shoulder + 0.11, "#55794e88");
  ribbon(roadPoints, -shoulder, shoulder, turboGradient(ctx, floor, h, "#e8d69a", "#bd9565"));
  const edge = turboRoad.halfWidth;
  ribbon(roadPoints, -edge, edge, turboGradient(ctx, floor, h, "#777e87", "#455068"));
  ribbon(roadPoints, -edge, -edge + 0.13, "#3d455b73");
  ribbon(roadPoints, edge - 0.13, edge, "#3d455b73");
  ribbon(roadPoints, -edge + 0.13, -edge + 0.175, "#fff1c8");
  ribbon(roadPoints, edge - 0.175, edge - 0.13, "#fff1c8");
  for (let z = Math.floor((ride.z + viewDistance) / 14) * 14; z + 6 > ride.z; z -= 14) {
    const far = Math.min(viewDistance, z + 6 - ride.z);
    const near = Math.max(0, z - ride.z);
    const points = [project(far, turboRoad.center(ride.z + far)), project(near, turboRoad.center(ride.z + near))];
    ribbon(points, -0.049, 0.049, "#fff0b9");
    const side = Math.round(z / 14) % 2 === 0 ? -1 : 1;
    ribbon(points, side * (edge + 0.04), side * (edge + 0.09), "#ffe7ae99");
  }
  // Infinite scenery, but only the visible strips are drawn, back to front.
  for (let i = Math.floor((ride.z + viewDistance) / 13); i * 13 >= ride.z; i -= 1) {
    const z = i * 13;
    const side = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : i % 2 ? -1 : 1;
    const { x, y, p } = project(z - ride.z, turboRoad.center(z) + side * (2.63 + (i % 4) * 0.28));
    const size = Math.min(h * 0.27, w * 0.35) * p;
    if (i % 7 === 3) {
      turboSign(ctx, x, y, size, turboRoad.center(z + 35) > turboRoad.center(z) ? 1 : -1);
    } else if (i % 5 === 0 || i % 5 === 4) {
      turboFlowers(ctx, x, y, size, i % 2);
    } else {
      turboTree(ctx, x, y, size * (i % 4 === 1 ? 1.1 : 0.86), i % 3);
    }
    const post = project(z - ride.z, turboRoad.center(z) - side * 2.31);
    turboOval(ctx, post.x, post.y, size * 0.11, size * 0.035, "#4e723b53");
    ctx.fillStyle = "#daddbd";
    ctx.fillRect(post.x - size * 0.032, post.y - size * 0.178, size * 0.064, size * 0.178);
    ctx.fillStyle = "#c7654f";
    ctx.fillRect(post.x - size * 0.032, post.y - size * 0.177, size * 0.064, size * 0.04);
  }
  for (let i = ride.next + 3; i >= ride.next; i -= 1) {
    const star = turboRoad.pickup(i);
    const depth = star.z - ride.z;
    if (depth < 0 || depth > viewDistance) continue;
    const { x, y, p } = project(depth, star.x);
    const radius = Math.max(9, Math.min(38, unit * 0.255) * p + 3);
    const float = reducedMotion ? 0 : Math.sin(ride.z * 0.10 + i) * radius * 0.17;
    turboOval(ctx, x, y, radius * 0.7, radius * 0.19, "#25253670");
    turboOval(ctx, x, y - radius * 1.38 + float, radius * 1.12, radius * 1.07, "#fff2a44b");
    turboStar(ctx, x, y - radius * 1.38 + float, radius);
  }
  const rider = project(0, ride.x);
  const size = Math.min(h * 0.245, w * 0.31, 164);
  turboCyclist(ctx, rider.x, rider.y, size, ride, reducedMotion);
  if (ride.spark && !reducedMotion) {
    const spread = (0.52 - ride.spark) * size;
    ctx.globalAlpha = Math.min(1, ride.spark * 4);
    turboStar(ctx, rider.x - size * 0.36 - spread, rider.y - size * 0.62 - spread, size * 0.11);
    turboStar(ctx, rider.x + size * 0.4 + spread, rider.y - size * 0.51 - spread * 0.75, size * 0.08);
    ctx.globalAlpha = 1;
  }
}

function turboGradient(ctx, y, endY, light, dark) {
  const gradient = ctx.createLinearGradient(0, y, 0, endY);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  return gradient;
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
  ctx.fillStyle = turboGradient(ctx, y - radius, y + radius, "#fff3a4", "#efa333");
  ctx.strokeStyle = "#85421d";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.stroke();
  ctx.fill();
  turboOval(ctx, x - radius * 0.18, y - radius * 0.12, radius * 0.13, radius * 0.18, "#fff6b1");
}

function turboTree(ctx, x, y, size, kind) {
  turboOval(ctx, x + size * 0.11, y, size * 0.35, size * 0.078, "#416d495e");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.fillStyle = "#785b45";
  ctx.fillRect(-0.048, -0.58, 0.096, 0.58);
  ctx.fillStyle = "#ba9060";
  ctx.fillRect(-0.04, -0.58, 0.03, 0.56);
  if (kind === 1) {
    for (let i = 0; i < 3; i += 1) {
      const level = -0.27 - i * 0.19;
      const width = 0.32 - i * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, level - 0.41);
      ctx.quadraticCurveTo(width * 0.4, level - 0.16, width, level);
      ctx.quadraticCurveTo(0, level + 0.12, -width, level);
      ctx.quadraticCurveTo(-width * 0.4, level - 0.16, 0, level - 0.41);
      ctx.fillStyle = turboGradient(ctx, level - 0.41, level, "#86bd73", "#357c61");
      ctx.fill();
    }
  } else {
    const tall = kind === 2 ? 1.15 : 1;
    turboOval(ctx, 0, -0.59 * tall, 0.35, 0.33 * tall, "#397b57");
    turboOval(ctx, -0.13, -0.70 * tall, 0.24, 0.24 * tall, "#6ca15b");
    turboOval(ctx, 0.13, -0.68 * tall, 0.21, 0.25 * tall, "#589859");
    turboOval(ctx, -0.12, -0.80 * tall, 0.16, 0.14 * tall, "#a2c779");
    if (kind === 2) {
      for (const [a, b] of [[-0.17,-0.62],[0.16,-0.79],[0.23,-0.59]]) turboOval(ctx, a, b, 0.024, 0.025, "#f4c970");
    }
  }
  ctx.restore();
}

function turboFlowers(ctx, x, y, size, tint) {
  turboOval(ctx, x, y, size * 0.27, size * 0.07, "#598a4b88");
  for (const [dx, dy] of [[-0.18,0.10],[-0.04,0.15],[0.15,0.11],[0.25,0.2]]) {
    turboOval(ctx, x + dx * size, y - dy * size, size * 0.036, size * 0.04, tint ? "#ffb4a5" : "#fff0ab");
    turboOval(ctx, x + dx * size - size * 0.006, y - dy * size, size * 0.016, size * 0.016, "#d67857");
  }
}

function turboSign(ctx, x, y, size, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  turboOval(ctx, 0.08, 0, 0.25, 0.065, "#487c506c");
  ctx.fillStyle = "#87694d";
  ctx.fillRect(-0.032, -0.5, 0.064, 0.5);
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.roundRect(-0.19, -0.56, 0.38, 0.24, 0.04);
  ctx.fillStyle = "#ffe18d";
  ctx.fill();
  ctx.strokeStyle = "#815d4c";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.06 * side, -0.49);
  ctx.lineTo(0.07 * side, -0.44);
  ctx.lineTo(-0.06 * side, -0.39);
  ctx.stroke();
  ctx.restore();
}

function turboCyclist(ctx, x, y, size, ride, reduce) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  turboOval(ctx, 3, 1, 34, 8, "#1e324777");
  const tilt = ride.lean * 0.16;
  ctx.rotate(tilt);
  const line = (color, width, ...points) => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  turboOval(ctx, 2 + tilt * 27, -33, 5.5, 16, "#243248");
  turboOval(ctx, 0, -17, 9.8, 21, "#20253a");
  turboOval(ctx, 0, -17, 5.9, 16, "#789298");
  turboOval(ctx, 0, -17, 3.9, 13, "#3a4b63");
  line("#c4dbcb", 1.35, -3, -11, 3, -23);
  line("#c4dbcb", 1.35, -3, -22, 3, -12);
  line("#206363", 8, 0, -17, 0, -48, 8, -55);
  line("#70ddd0", 4.5, -2, -18, -2, -45, 7, -53);
  line("#202b45", 6.5, -28, -56, -18, -60, 18, -60, 28, -56);
  line("#c8dcd0", 2, -19, -61, 19, -61);
  const phase = reduce ? 0 : ride.z * 0.21;
  for (const side of [-1, 1]) {
    const pedal = Math.sin(phase) * side;
    const footY = -16 + pedal * 8;
    line("#27334b", 11.5, side * 10, -42, side * (18 + pedal * 2.2), -28 - pedal * 4, side * 14, footY);
    line("#647f8c", 4.5, side * 12, -40, side * (18 + pedal * 2.2), -28 - pedal * 4);
    line("#393c4b", 3.4, 0, -19, side * 15, footY + 3, side * 23, footY + 3);
    line("#fff2cd", 7, side * 14, footY, side * 21, footY - 1);
    line("#d78f6f", 8, side * 11, -67, side * 22, -61, side * 27, -56);
    line("#f8b591", 2.4, side * 17, -65, side * 24, -60);
    turboOval(ctx, side * 27, -56, 4, 3.6, "#40576a");
  }
  turboOval(ctx, 0, -57, 19, 18, "#8f4251");
  turboOval(ctx, 0, -61, 18, 15, turboGradient(ctx, -75, -46, "#fa9977", "#c94f56"));
  line("#f9bb83", 3, -12, -71, -10, -58, -11, -49);
  line("#f9bb83", 3, 12, -71, 10, -58, 11, -49);
  turboOval(ctx, 0, -58, 8, 10, "#9b4a54");
  turboOval(ctx, 0, -60, 6, 7.2, "#ffc878");
  turboOval(ctx, -1, -62, 2.5, 2.5, "#fff2bc");
  turboOval(ctx, 0, -80, 19, 16, "#984923");
  turboOval(ctx, 0, -83, 20, 14, turboGradient(ctx, -98, -69, "#fff2a4", "#e49e38"));
  line("#fff7c5", 4, -10, -90, 0, -94, 10, -92);
  line("#946037", 3, -17, -80, 0, -76, 17, -80);
  for (const side of [-1,1]) turboOval(ctx, side * 12, -86, 2.3, 1.6, "#ad723f");
  ctx.restore();
}
