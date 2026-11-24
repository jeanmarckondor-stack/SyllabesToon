const golfWidth = 720;
const golfHeight = 440;
const golfBallRadius = 11;
const golfCupRadius = 20;
const golfFriction = 220;
const golfCourses = [
  {
    outline: [[68, 145], [652, 145], [652, 295], [68, 295]],
    start: { x: 130, y: 220 }, cup: { x: 587, y: 220 },
    turf: "#6db962", stripe: "#79c46c", rim: "#f8c16e", flag: "#e35173",
  },
  {
    outline: [[62, 235], [483, 235], [483, 54], [666, 54], [666, 396], [62, 396]],
    start: { x: 124, y: 318 }, cup: { x: 575, y: 111 },
    turf: "#61ad82", stripe: "#6fb98d", rim: "#a9a2e5", flag: "#e86b37",
  },
  {
    outline: [[62, 108], [650, 108], [684, 142], [684, 300], [650, 334], [62, 334], [34, 306], [34, 136]],
    start: { x: 105, y: 220 }, cup: { x: 598, y: 220 },
    mill: { x: 358, y: 223, radius: 46 },
    turf: "#72b453", stripe: "#82be5e", rim: "#eea0b0", flag: "#6261cb",
  },
];

function golfClosestPoint(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return { x: ax + t * dx, y: ay + t * dy };
}

function golfShot(dx, dy, portrait) {
  // Power is measured in CSS pixels, independent of the zoom or orientation of the course.
  const length = Math.hypot(dx, dy);
  if (length < 9) return null;
  const power = Math.min(1, (length - 9) / 95);
  const distance = 12 + 538 * power ** 1.5;
  return { dx: (portrait ? -dy : dx) / length, dy: (portrait ? dx : dy) / length, distance, power };
}

function hitGolfBall(ball, shot) {
  if (!shot || ball.vx || ball.vy) return false;
  const speed = Math.sqrt(2 * golfFriction * shot.distance);
  ball.vx = shot.dx * speed;
  ball.vy = shot.dy * speed;
  return true;
}

function advanceGolfBall(ball, course, elapsed, onBounce) {
  const collide = (x, y, gap) => {
    const dx = ball.x - x;
    const dy = ball.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance >= gap) return;
    const nx = dx / distance;
    const ny = dy / distance;
    ball.x = x + nx * gap;
    ball.y = y + ny * gap;
    const inward = ball.vx * nx + ball.vy * ny;
    if (inward < 0) {
      ball.vx -= 1.78 * inward * nx;
      ball.vy -= 1.78 * inward * ny;
      if (inward < -45) onBounce?.(x, y);
    }
  };

  // Small steps keep the ball on the correct side of walls, even on a slow frame.
  while (elapsed > 0) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (!speed) break;
    const dt = Math.min(elapsed, 1 / 160, speed / golfFriction);
    const nextSpeed = Math.max(0, speed - golfFriction * dt);
    const travel = (1 + nextSpeed / speed) * dt / 2;
    ball.x += ball.vx * travel;
    ball.y += ball.vy * travel;
    ball.vx *= nextSpeed / speed;
    ball.vy *= nextSpeed / speed;
    for (let i = 0; i < course.outline.length; i += 1) {
      const a = course.outline[i];
      const b = course.outline[(i + 1) % course.outline.length];
      const p = golfClosestPoint(ball.x, ball.y, ...a, ...b);
      collide(p.x, p.y, golfBallRadius);
    }
    if (course.mill) collide(course.mill.x, course.mill.y, course.mill.radius + golfBallRadius);
    if (Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y) <= golfCupRadius) {
      ball.vx = ball.vy = 0;
      return "cup";
    }
    if (Math.hypot(ball.vx, ball.vy) < 2) {
      ball.vx = ball.vy = 0;
      break;
    }
    elapsed -= dt;
  }
  return ball.vx || ball.vy ? "rolling" : "stopped";
}

function startFunnyGolf({ arena, signal, onProgress, onWin }) {
  const canvas = document.createElement("canvas");
  canvas.className = "funny-golf-canvas";
  canvas.setAttribute("aria-hidden", "true");
  arena.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  const terrain = document.createElement("canvas");
  const terrainCtx = terrain.getContext("2d", { alpha: false });
  const meter = document.createElement("div");
  meter.className = "funny-golf-meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", "Puissance");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.append(...Array.from({ length: 5 }, () => document.createElement("span")));
  meter.hidden = true;
  arena.append(meter);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let view;
  let courseIndex = 0;
  let course;
  let ball;
  let drag = null;
  let phase = "aim";
  let effect = 0;
  let millAngle = 0;
  let travel = 0;
  let impact = null;
  let frame;
  let lastFrame;
  let lastPaint = 0;

  function paintTerrain() {
    terrain.width = canvas.width;
    terrain.height = canvas.height;
    terrainCtx.setTransform(canvas.width / view.width, 0, 0, canvas.height / view.height, 0, 0);
    drawGolfTerrain(terrainCtx, view, course, courseIndex);
  }

  function nextCourse() {
    course = golfCourses[courseIndex];
    ball = { ...course.start, vx: 0, vy: 0 };
    travel = 0;
    impact = null;
    phase = "aim";
    if (view) paintTerrain();
  }

  function paint() {
    if (!view) return;
    drawFunnyGolf(ctx, view, terrain, course, ball, drag?.shot, effect, millAngle, travel, impact, motion.matches);
    lastPaint = performance.now();
  }

  function clearDrag() {
    if (!drag) return;
    const pointer = drag.id;
    drag = null;
    meter.hidden = true;
    arena.classList.remove("is-aiming");
    if (arena.hasPointerCapture(pointer)) arena.releasePointerCapture(pointer);
  }

  function measure() {
    const { clientWidth: width, clientHeight: height } = arena;
    if (!width || !height || (view?.width === width && view.height === height)) return;
    clearDrag();
    const portrait = height > width;
    const scale = Math.min((width - 16) / (portrait ? golfHeight : golfWidth),
      (height - 10) / (portrait ? golfWidth : golfHeight));
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    view = { width, height, scale, portrait };
    paintTerrain();
    paint();
  }

  function tick(now) {
    frame = null;
    const dt = lastFrame === undefined ? 0 : Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!motion.matches) millAngle += dt * 1.3;
    if (impact) {
      impact.life -= dt;
      if (impact.life <= 0) impact = null;
    }
    if (phase === "roll") {
      const { x, y } = ball;
      const result = dt ? advanceGolfBall(ball, course, dt, (bx, by) => {
        if (!motion.matches) impact = { x: bx, y: by, life: 0.28 };
      }) : "rolling";
      travel += Math.hypot(ball.x - x, ball.y - y);
      if (result === "stopped") {
        phase = "aim";
      } else if (result === "cup") {
        phase = "cup";
        effect = 1;
        onProgress(courseIndex + 1, golfCourses.length);
        window.SyllabesToonAudio.playProgressChime();
      }
    } else if (phase === "cup") {
      effect = Math.max(0, effect - dt / 0.85);
      if (!effect) {
        if (courseIndex + 1 === golfCourses.length) {
          onWin("Bravo ! Trois trous réussis !");
          return;
        }
        courseIndex += 1;
        nextCourse();
      }
    }
    if (phase !== "aim" || now - lastPaint >= 30) paint();
    schedule();
  }

  function schedule() {
    if (signal.aborted || frame != null || (phase === "aim" && motion.matches)) return;
    frame = window.requestAnimationFrame(tick);
  }

  function updateDrag(event) {
    drag.shot = golfShot(event.clientX - drag.x, event.clientY - drag.y, view.portrait);
    const power = drag.shot?.power ?? 0;
    meter.setAttribute("aria-valuenow", Math.round(power * 100));
    [...meter.children].forEach((segment, i) => segment.classList.toggle("on", Boolean(drag.shot) && power >= i / 5));
    paint();
  }

  arena.addEventListener("pointerdown", (event) => {
    if (phase !== "aim" || drag || !view || event.button !== 0) return;
    const r = arena.getBoundingClientRect();
    const x = (event.clientX - r.left - view.width / 2) / view.scale;
    const y = (event.clientY - r.top - view.height / 2) / view.scale;
    const point = { x: golfWidth / 2 + (view.portrait ? -y : x), y: golfHeight / 2 + (view.portrait ? x : y) };
    const grabRadius = Math.max(36, golfBallRadius * view.scale + 15);
    if (Math.hypot(point.x - ball.x, point.y - ball.y) * view.scale > grabRadius) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, shot: null };
    arena.setPointerCapture(event.pointerId);
    arena.classList.add("is-aiming");
    meter.hidden = false;
    updateDrag(event);
  }, { signal });

  window.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    if (event.pointerType === "mouse" && !(event.buttons & 1)) cancel();
    else updateDrag(event);
  }, { signal });
  window.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    const shot = golfShot(event.clientX - drag.x, event.clientY - drag.y, view.portrait);
    clearDrag();
    if (hitGolfBall(ball, shot)) {
      phase = "roll";
      lastFrame = performance.now();
      schedule();
    }
    paint();
  }, { signal });
  const cancel = () => {
    clearDrag();
    paint();
  };
  window.addEventListener("pointercancel", (event) => {
    if (drag?.id === event.pointerId) cancel();
  }, { signal });
  window.addEventListener("blur", cancel, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancel();
    else lastFrame = undefined;
  }, { signal });
  motion.addEventListener("change", () => {
    paint();
    schedule();
  }, { signal });

  const observer = new ResizeObserver(measure);
  signal.addEventListener("abort", () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    clearDrag();
  }, { once: true });
  nextCourse();
  onProgress(0, golfCourses.length);
  measure();
  observer.observe(arena);
  schedule();
}

function golfWorld(ctx, view) {
  ctx.translate(view.width / 2, view.height / 2);
  ctx.scale(view.scale, view.scale);
  if (view.portrait) ctx.rotate(-Math.PI / 2);
  ctx.translate(-golfWidth / 2, -golfHeight / 2);
}

function golfArt(ctx) {
  const ellipse = (x, y, rx, ry, color) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const shape = (points) => {
    ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x, y);
  };
  const fill = (color, points) => {
    shape(points);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const stroke = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke();
  };
  const line = (color, width, points) => {
    shape(points);
    stroke(color, width);
  };
  const blend = (x, y, endY, top, bottom) => {
    const gradient = ctx.createLinearGradient(x, y, x, endY);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    return gradient;
  };
  return { ellipse, shape, fill, stroke, line, blend };
}

function drawGolfTerrain(ctx, view, course, index) {
  const { ellipse, shape, fill, stroke, line, blend } = golfArt(ctx);
  const backdrops = [["#eaf3bb", "#abc681"], ["#d9ecc6", "#91bb8b"], ["#e1edbb", "#a6cbad"]];
  ctx.fillStyle = blend(0, 0, view.height, ...backdrops[index]);
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  golfWorld(ctx, view);
  let seed = 17 + index;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 155; i += 1) {
    const x = random() * 720, y = random() * 440;
    ellipse(x, y, 4 + random() * 12, 1 + random() * 2, i % 2 ? "#49774e16" : "#fffbd835");
  }

  function flowers(x, y, accent, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ellipse(5, 11, 14, 4, "#34633c30");
    for (const [dx, dy] of [[0, 0], [-11, 4], [11, 4]]) {
      line("#498354", 2.1, [[dx, dy], [dx + 3, 10]]);
      for (let j = 0; j < 5; j += 1) {
        const a = j * Math.PI * 2 / 5;
        ellipse(dx + Math.cos(a) * 4, dy + Math.sin(a) * 4, 3.3, 3.3, accent);
      }
      ellipse(dx, dy, 2.7, 2.7, "#e7a247");
    }
    ctx.restore();
  }
  function bush(x, y, size, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ellipse(6, 12, 33, 11, "#325b4432");
    ellipse(0, 1, 29, 16, "#497c51");
    ellipse(-16, -3, 15, 15, "#639859");
    ellipse(9, -7, 19, 17, light ? "#93bf65" : "#6dad77");
    ellipse(5, -12, 11, 8, light ? "#bdd780" : "#93c78d");
    ctx.restore();
  }
  function stone(x, y, size) {
    ellipse(x + 2, y + 5, size * 1.1, size * 0.44, "#365d4b35");
    fill("#789592", [[x - size, y], [x - size * 0.7, y - size * 0.62], [x + size * 0.4, y - size * 0.7], [x + size, y], [x + size * 0.65, y + 4], [x - size * 0.6, y + 4]]);
    fill("#adc0ad", [[x - size * 0.7, y - size * 0.62], [x + size * 0.4, y - size * 0.7], [x + 3, y - 2], [x - size, y]]);
  }

  if (index === 0) {
    for (const [x, y, accent] of [[83, 92, "#fff6e0"], [187, 109, "#eb8099"], [298, 72, "#f4d057"], [493, 91, "#ee93aa"], [610, 78, "#fff2d2"], [141, 355, "#f9cd5c"], [342, 369, "#e785ae"], [564, 347, "#f9f2e0"]]) flowers(x, y, accent, 1.27);
    for (const [x, y] of [[58, 358], [233, 350], [433, 92], [658, 365]]) bush(x, y, 0.96, true);
    stone(534, 366, 17);
    stone(555, 371, 8);
  } else if (index === 1) {
    ellipse(203, 128, 111, 61, "#59876e50");
    ellipse(197, 122, 109, 59, "#b7d6aa");
    ellipse(197, 122, 101, 51, blend(197, 70, 173, "#9edfd8", "#67afbb"));
    for (const [x, y] of [[137, 113], [226, 140], [263, 100]]) {
      line("#d9f1d5", 2, [[x - 12, y], [x, y + 1], [x + 9, y]]);
      ellipse(x + 3, y + 6, 9, 3.2, "#75a76e");
    }
    for (let x = 318; x <= 434; x += 29) {
      if (x !== 434) {
        line("#8e7854", 5, [[x, 128], [x + 29, 128]]);
        line("#be9f66", 4, [[x, 116], [x + 29, 116]]);
      }
      line("#b08d61", 7, [[x, 138], [x, 106]]);
      line("#e0bf84", 2, [[x - 2, 133], [x - 2, 108]]);
    }
    bush(387, 79, 1.42, false);
    bush(410, 186, 1.08, true);
    flowers(345, 173, "#fff2bf");
    stone(92, 198, 16);
    stone(116, 201, 9);
  } else {
    for (const [x, y] of [[95, 61], [193, 373], [314, 63], [468, 376], [623, 65]]) {
      bush(x, y, 0.83, false);
      flowers(x + 23, y + 14, "#e8aadc");
    }
    for (const [x, y, s] of [[590, 369, 21], [613, 374, 11], [235, 76, 13], [650, 380, 13]]) stone(x, y, s);
  }

  const outline = () => { shape(course.outline); ctx.closePath(); };
  ctx.save();
  ctx.translate(view.portrait ? -12 : 3, view.portrait ? 3 : 12);
  outline();
  stroke("#4663473b", 27);
  ctx.restore();
  ctx.save();
  ctx.translate(view.portrait ? -6 : 0, view.portrait ? 0 : 6);
  outline();
  stroke(["#a67551", "#726c9a", "#ad657b"][index], 18);
  ctx.restore();
  outline();
  ctx.fillStyle = blend(0, 95, 405, course.stripe, course.turf);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "#f9fadd15";
  ctx.lineWidth = 31;
  for (let x = -70; x < 720; x += 66) line("#fff8bf1b", 31, [[x, 0], [x + 78, 440]]);
  for (let i = 0; i < 195; i += 1) {
    const x = random() * 720, y = random() * 440;
    ellipse(x, y, 1 + random() * 3.8, 0.9, i % 2 ? "#2c5b2f23" : "#fffbc249");
  }
  ellipse(course.start.x, course.start.y, 27, 27, "#fff8c43a");
  ellipse(course.cup.x, course.cup.y, 41, 39, "#48754135");
  ellipse(course.cup.x, course.cup.y, 37, 35, "#bfdf8b");
  ctx.restore();

  outline();
  stroke(course.rim, 16);
  stroke("#fff6d28c", 3);
  for (let i = 0; i < course.outline.length; i += 1) {
    const [x, y] = course.outline[i];
    const [bx, by] = course.outline[(i + 1) % course.outline.length];
    const count = Math.floor(Math.hypot(bx - x, by - y) / 32);
    for (let j = 1; j <= count; j += 1) {
      const t = j / (count + 1);
      ellipse(x + (bx - x) * t, y + (by - y) * t, 1.9, 1.9, "#694e4369");
    }
  }
  ctx.restore();
}

function drawFunnyGolf(ctx, view, terrain, course, ball, shot, effect, time, travel, impact, reduce) {
  ctx.drawImage(terrain, 0, 0, view.width, view.height);
  ctx.save();
  golfWorld(ctx, view);
  const { ellipse, fill, line, blend } = golfArt(ctx);

  if (course.mill) {
    const { x, y, radius } = course.mill;
    ellipse(x + 5, y + 7, radius + 3, radius - 1, "#38574657");
    ellipse(x, y, radius, radius, "#726360");
    ellipse(x, y, radius - 3, radius - 3, blend(x, y - radius, y + radius, "#eddfb6", "#bd9f85"));
    for (let i = 0; i < 13; i += 1) {
      const angle = i * Math.PI * 2 / 13;
      ellipse(x + Math.cos(angle) * 38, y + Math.sin(angle) * 38, 3.7, 2.4, "#a68b78");
    }
    ctx.save();
    ctx.translate(x, y);
    if (view.portrait) ctx.rotate(Math.PI / 2);
    ellipse(5, 21, 25, 9, "#5c594655");
    fill(blend(0, -20, 24, "#fff4cf", "#d1ab82"), [[-17, -17], [14, -17], [21, 22], [-21, 22]]);
    fill("#c39a77", [[4, -16], [14, -17], [21, 22], [9, 22]]);
    line("#a96b61", 1.5, [[-18, 12], [-13, 12]]);
    line("#ba9474", 1.5, [[12, 9], [18, 9]]);
    ellipse(-3, 12, 7, 8, "#7f5164");
    ctx.fillStyle = "#7f5164";
    ctx.fillRect(-10, 12, 14, 10);
    ellipse(-1, 15, 1.4, 1.4, "#ffd67f");
    fill("#704757", [[-25, -15], [-5, -36], [13, -31], [24, -15], [19, -10], [-24, -10]]);
    fill("#c46b71", [[-25, -15], [-5, -36], [13, -31], [4, -14]]);
    line("#f2a88a", 2.3, [[-19, -17], [-5, -30], [5, -29]]);
    ctx.translate(0, -8);
    ctx.rotate(0.4 + time * 0.63);
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      line("#6e5262", 3.8, [[0, 0], [0, -28]]);
      fill("#fff2c9", [[1, -8], [12, -13], [11, -29], [1, -28]]);
      line("#bc9b88", 1, [[3, -12], [3, -25]]);
      line("#bc9b88", 1.2, [[3, -19], [10, -20]]);
    }
    ellipse(0, 0, 5.2, 5.2, "#744558");
    ellipse(-1, -1, 2.4, 2.4, "#efb991");
    ctx.restore();
  }

  const { x, y } = course.cup;
  ellipse(x + 1, y + 3, golfCupRadius + 5, golfCupRadius + 3, "#6f985c");
  ellipse(x, y, golfCupRadius + 3, golfCupRadius + 3, "#fff6cd");
  ellipse(x, y, golfCupRadius, golfCupRadius, blend(x, y - 18, y + 17, "#17382f", "#3c6251"));
  ellipse(x - 3, y + 9, 11, 3, "#79b58b5c");
  ctx.save();
  ctx.translate(x, y);
  if (view.portrait) ctx.rotate(Math.PI / 2);
  line("#213e376b", 5, [[1, -4], [32, 17]]);
  line("#f8efcd", 4, [[1, -6], [1, -64]]);
  ellipse(1, -64, 4, 4, "#edb760");
  const wave = Math.sin(time * 3) * 3;
  ctx.beginPath();
  ctx.moveTo(3, -61);
  ctx.bezierCurveTo(19, -65 + wave, 34, -49 - wave, 42, -57 + wave);
  ctx.bezierCurveTo(32, -40 + wave, 13, -49, 3, -44);
  ctx.fillStyle = course.flag;
  ctx.fill();
  line("#fff3ce", 1.6, [[8, -59], [18, -58 + wave * 0.5], [28, -54]]);
  ctx.restore();

  if (shot) {
    const length = 35 + shot.power * 92;
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(Math.atan2(shot.dy, shot.dx));
    for (const [color, width] of [["#2b5148", 8], ["#fff7be", 4]]) {
      line(color, width, [[15, 0], [length, 0]]);
      line(color, width, [[length - 12, -8], [length, 0], [length - 12, 8]]);
    }
    ctx.restore();
  }
  if (impact && !reduce) {
    const size = 5 + (0.28 - impact.life) * 52;
    ctx.globalAlpha = impact.life / 0.28;
    line("#fff1bf", 2.4, [[impact.x, impact.y - size], [impact.x, impact.y + size]]);
    line("#fff1bf", 2.4, [[impact.x - size, impact.y], [impact.x + size, impact.y]]);
    ctx.globalAlpha = 1;
  }

  if (effect) {
    const radius = reduce ? 28 : 24 + (1 - effect) * 34;
    ctx.globalAlpha = effect;
    for (let i = 0; i < 7; i += 1) {
      const a = i * Math.PI * 2 / 7;
      ellipse(x + radius * Math.cos(a), y + radius * Math.sin(a), 2.6, 3.3, i % 2 ? "#fff9ce" : "#ffe07b");
    }
    ctx.globalAlpha = 1;
  } else {
    const { x: bx, y: by } = ball;
    ellipse(bx + 3, by + 5, 14, 9, "#254c435f");
    const shade = ctx.createRadialGradient(bx - 3.5, by - 4.5, 1, bx, by, 12);
    shade.addColorStop(0, "#fffef2");
    shade.addColorStop(0.65, "#f6faf3");
    shade.addColorStop(1, "#8caeb2");
    ellipse(bx, by, golfBallRadius + 0.6, golfBallRadius + 0.6, "#517b77");
    ellipse(bx, by, golfBallRadius, golfBallRadius, shade);
    const turn = reduce ? 0 : travel / golfBallRadius;
    for (let i = 0; i < 5; i += 1) {
      const angle = turn + i * 1.26;
      ellipse(bx + Math.cos(angle) * (i % 2 ? 6 : 3), by + Math.sin(angle) * 5 + 2, 1.1, 0.85, "#b5c9c6");
    }
    ellipse(bx - 4.1, by - 4.7, 2.5, 1.6, "#ffffff");
  }
  ctx.restore();
}
