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
    corner: { x: 570, y: 318 },
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

function golfSuggestedAim(course, ball) {
  if (course.corner && ball.x < 510) return course.corner;
  if (course.mill) {
    const { x, y, radius } = course.mill;
    if (Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y) < 1) return course.cup;
    const p = golfClosestPoint(x, y, ball.x, ball.y, course.cup.x, course.cup.y);
    if (Math.hypot(x - p.x, y - p.y) < radius + golfBallRadius + 6) {
      return { x, y: y + (ball.y <= y ? -1 : 1) * (radius + 31) };
    }
  }
  return course.cup;
}

function hitGolfBall(ball, aim) {
  const dx = aim.x - ball.x;
  const dy = aim.y - ball.y;
  const distance = Math.hypot(dx, dy);
  if (distance < golfBallRadius) return false;
  const speed = Math.sqrt(2 * golfFriction * distance);
  ball.vx = dx * speed / distance;
  ball.vy = dy * speed / distance;
  return true;
}

function advanceGolfBall(ball, course, elapsed) {
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

function startFunnyGolf({ arena, controls, signal, onProgress, onWin }) {
  const canvas = document.createElement("canvas");
  canvas.className = "funny-golf-canvas";
  canvas.setAttribute("aria-hidden", "true");
  arena.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  const hit = document.createElement("button");
  hit.type = "button";
  hit.id = "funnyGolfHit";
  hit.className = "space-bonus-primary";
  hit.textContent = "TAPER";
  controls.append(hit);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let view;
  let courseIndex = 0;
  let course;
  let ball;
  let aim;
  let phase;
  let effect = 0;
  let millAngle = 0;
  let frame;
  let lastFrame;

  function ready() {
    phase = "aim";
    aim = golfSuggestedAim(course, ball);
    hit.disabled = false;
  }

  function nextCourse() {
    course = golfCourses[courseIndex];
    ball = { ...course.start, vx: 0, vy: 0 };
    ready();
  }

  function paint() {
    if (view) drawFunnyGolf(ctx, view, course, ball, phase === "aim" ? aim : null, effect, millAngle, motion.matches);
  }

  function measure() {
    const { clientWidth: width, clientHeight: height } = arena;
    if (!width || !height || (view?.width === width && view.height === height)) return;
    const portrait = height > width;
    const scale = Math.min((width - 16) / (portrait ? golfHeight : golfWidth),
      (height - 10) / (portrait ? golfWidth : golfHeight));
    const ratio = Math.min(window.devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    view = { width, height, scale, portrait };
    paint();
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!motion.matches) millAngle += dt * 1.3;
    if (phase === "roll") {
      const result = advanceGolfBall(ball, course, dt);
      if (result === "stopped") {
        ready();
        paint();
        return;
      }
      if (result === "cup") {
        phase = "cup";
        effect = 1;
        onProgress(courseIndex + 1, golfCourses.length);
        window.SyllabesToonAudio.playProgressChime();
      }
    } else {
      effect = Math.max(0, effect - dt / 0.85);
      if (!effect) {
        if (courseIndex + 1 === golfCourses.length) {
          onWin("Bravo ! Trois trous réussis !");
          return;
        }
        courseIndex += 1;
        nextCourse();
        paint();
        return;
      }
    }
    paint();
    frame = window.requestAnimationFrame(tick);
  }

  arena.addEventListener("pointerdown", (event) => {
    if (phase !== "aim" || !view || event.button !== 0) return;
    const r = arena.getBoundingClientRect();
    const x = (event.clientX - r.left - view.width / 2) / view.scale;
    const y = (event.clientY - r.top - view.height / 2) / view.scale;
    const point = { x: golfWidth / 2 + (view.portrait ? -y : x), y: golfHeight / 2 + (view.portrait ? x : y) };
    if (point.x < 0 || point.x > golfWidth || point.y < 0 || point.y > golfHeight) return;
    const suggested = golfSuggestedAim(course, ball);
    if (Math.hypot(point.x - ball.x, point.y - ball.y) < golfBallRadius * 1.5) return;
    aim = Math.hypot(point.x - suggested.x, point.y - suggested.y) < 38 ? suggested : point;
    paint();
  }, { signal });

  hit.addEventListener("click", () => {
    if (phase !== "aim" || !hitGolfBall(ball, aim)) return;
    phase = "roll";
    hit.disabled = true;
    lastFrame = performance.now();
    frame = window.requestAnimationFrame(tick);
  }, { signal });

  const observer = new ResizeObserver(measure);
  signal.addEventListener("abort", () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    hit.disabled = true;
  }, { once: true });
  nextCourse();
  onProgress(0, golfCourses.length);
  measure();
  observer.observe(arena);
  hit.focus({ preventScroll: true });
}

function drawFunnyGolf(ctx, view, course, ball, aim, effect, millAngle, reduce) {
  ctx.fillStyle = "#d6eec8";
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(view.width / 2, view.height / 2);
  ctx.scale(view.scale, view.scale);
  if (view.portrait) ctx.rotate(-Math.PI / 2);
  ctx.translate(-golfWidth / 2, -golfHeight / 2);

  const ellipse = (x, y, rx, ry, color) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const outline = () => {
    ctx.beginPath();
    for (const [x, y] of course.outline) ctx.lineTo(x, y);
    ctx.closePath();
  };
  const line = (color, width, points) => {
    ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke();
  };

  for (const [x, y] of [[73, 73], [204, 87], [376, 55], [452, 80], [638, 368], [231, 367], [96, 371], [500, 395]]) {
    ellipse(x, y + 9, 27, 13, "#b5dba7");
    ellipse(x - 13, y, 15, 14, "#8cc485");
    ellipse(x + 12, y + 1, 17, 14, "#91cb90");
    ellipse(x, y - 8, 16, 15, "#a6d799");
    ellipse(x - 5, y - 13, 3, 3, "#fff8ce");
    ellipse(x + 14, y + 1, 2.4, 2.4, "#fff8ce");
  }

  ctx.save();
  ctx.translate(view.portrait ? -7 : 0, view.portrait ? 0 : 7);
  outline();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#68967c";
  ctx.lineWidth = 17;
  ctx.stroke();
  ctx.restore();
  outline();
  ctx.fillStyle = course.turf;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = course.stripe;
  for (let x = -90; x < golfWidth; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 34, 0);
    ctx.lineTo(x + 122, golfHeight);
    ctx.lineTo(x + 88, golfHeight);
    ctx.fill();
  }
  ctx.restore();
  outline();
  ctx.lineJoin = "round";
  ctx.strokeStyle = course.rim;
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.strokeStyle = "#fff6d4";
  ctx.lineWidth = 4;
  ctx.stroke();

  if (course.mill) {
    const { x, y, radius } = course.mill;
    ellipse(x, y, radius, radius, "#497568");
    ellipse(x, y, radius - 5, radius - 5, "#e6d2a5");
    ctx.save();
    ctx.translate(x, y);
    if (view.portrait) ctx.rotate(Math.PI / 2);
    ellipse(0, 15, 27, 12, "#a68a72");
    ctx.fillStyle = "#f8e7bb";
    ctx.fillRect(-17, -7, 34, 30);
    ctx.fillStyle = "#9a6486";
    ctx.fillRect(-5, 14, 10, 9);
    line("#9a536f", 9, [[-22, -7], [0, -22], [22, -7]]);
    ctx.translate(0, -7);
    ctx.rotate(millAngle + 0.38);
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      line("#7e4b66", 5, [[0, 0], [0, -24]]);
      line("#fff0bd", 8, [[3, -11], [3, -26]]);
    }
    ellipse(0, 0, 5, 5, "#814964");
    ctx.restore();
  }

  const cup = course.cup;
  ellipse(cup.x, cup.y, 31, 31, "#b3db77");
  ellipse(cup.x, cup.y, golfCupRadius + 3, golfCupRadius + 3, "#ecf5c8");
  ellipse(cup.x, cup.y, golfCupRadius, golfCupRadius, "#23483f");
  ctx.save();
  ctx.translate(cup.x, cup.y);
  if (view.portrait) ctx.rotate(Math.PI / 2);
  line("#fff4da", 5, [[1, -6], [1, -59]]);
  ctx.beginPath();
  ctx.moveTo(2, -59);
  ctx.quadraticCurveTo(22, -64, 36, -52);
  ctx.quadraticCurveTo(19, -42, 2, -43);
  ctx.fillStyle = course.flag;
  ctx.fill();
  ellipse(13, -52, 2.4, 2.4, "#fff8dd");
  ellipse(21, -53, 2.4, 2.4, "#fff8dd");
  line("#fff8dd", 1.5, [[13, -48], [17, -46], [21, -49]]);
  ctx.restore();

  if (aim) {
    const dx = aim.x - ball.x;
    const dy = aim.y - ball.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= golfBallRadius) {
      const length = Math.min(86, distance - 2);
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(Math.atan2(dy, dx));
      const arrow = [[15, 0], [length, 0]];
      const head = [[length - 12, -9], [length, 0], [length - 12, 9]];
      for (const [color, width] of [["#315747", 8], ["#fff6be", 4]]) {
        line(color, width, arrow);
        line(color, width, head);
      }
      ctx.restore();
      if (aim !== cup) ellipse(aim.x, aim.y, 5, 5, "#fff9c9");
    }
  }
  if (effect) {
    ctx.beginPath();
    ctx.arc(cup.x, cup.y, reduce ? 30 : 25 + (1 - effect) * 30, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff2a0";
    ctx.lineWidth = 4 * effect;
    ctx.stroke();
  } else {
    ellipse(ball.x + 2, ball.y + 5, 13, 10, "#34574c");
    ellipse(ball.x, ball.y, golfBallRadius, golfBallRadius, "#fffefa");
    ellipse(ball.x + 3, ball.y + 3, 2, 1.7, "#c4d6d8");
    ellipse(ball.x - 2, ball.y + 6, 1.5, 1.3, "#c4d6d8");
  }
  ctx.restore();
}
