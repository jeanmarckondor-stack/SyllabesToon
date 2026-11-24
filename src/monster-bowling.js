const bowlingLimit = (n, min, max) => Math.min(max, Math.max(min, n));
const bowlingRack = [[0, 8.1], [-0.62, 9], [0.62, 9], [-1.22, 9.94], [0, 9.94], [1.22, 9.94]];
const bowlingBallRadius = 0.43;
const bowlingColors = [
  ["#66ebae", "#17816b", "#d4ffc2"], ["#ff8cba", "#b33974", "#ffe1d1"],
  ["#78e0ff", "#306cbb", "#dbfaff"], ["#ffbb59", "#d16c38", "#fff1ab"],
  ["#b99aff", "#6844ba", "#f5dcff"], ["#ff886c", "#ac4352", "#ffe6b0"],
];

function bowlingAim(dx, dy, span) {
  const length = Math.hypot(dx, dy);
  if (dy > -11 || length < 16) return null;
  return {
    angle: bowlingLimit(dx / Math.max(40, -dy) * 0.31, -0.32, 0.32),
    power: bowlingLimit((length - 16) / bowlingLimit(span * 0.48, 100, 175), 0, 1),
  };
}

function createMonsterBowling() {
  const game = { round: 1, hits: 0, shot: 0, phase: "aim", time: 0, ball: null, banner: null };
  function rack() {
    const shift = [0, 0.15, -0.15][game.round - 1];
    game.pins = bowlingRack.map(([x, z], i) => ({
      x: x + shift, z, i, vx: 0, vz: 0, fall: 0, dx: 0, dz: 0, down: false,
    }));
  }
  rack();

  function launch(aim) {
    if (game.phase !== "aim" || !aim || !Number.isFinite(aim.angle) || !Number.isFinite(aim.power)) return false;
    const speed = 6.5 + 7 * bowlingLimit(aim.power, 0, 1);
    game.ball = { x: 0, z: 0, vx: speed * bowlingLimit(aim.angle, -0.32, 0.32), vz: speed, spin: 0, gutter: false };
    game.phase = "roll";
    game.shot += 1;
    return true;
  }

  function advance(dt) {
    const events = [];
    // Substeps keep a fast ball from crossing a pin between two rendered frames.
    while (dt > 0.00001) {
      const step = Math.min(dt, 0.008);
      update(step, events);
      dt -= step;
    }
    return events;
  }

  function topple(pin, dx, dz, energy, source, events) {
    const length = Math.hypot(dx, dz) || 1;
    pin.down = true;
    pin.dx = dx / length;
    pin.dz = dz / length;
    pin.vx = pin.dx * energy;
    pin.vz = pin.dz * energy;
    game.hits += 1;
    events.push({ kind: source, x: pin.x, z: pin.z, i: pin.i });
  }

  function update(dt, events) {
    game.time += dt;
    const ball = game.ball;
    if (game.phase === "roll" && ball) {
      ball.z += ball.vz * dt;
      if (!ball.gutter) ball.x += ball.vx * dt;
      if (Math.abs(ball.x) >= 2.14) ball.gutter = true;
      ball.vx *= Math.exp(-0.08 * dt);
      ball.vz *= Math.exp(-0.13 * dt);
      ball.spin += (ball.vz + Math.abs(ball.vx)) * dt / bowlingBallRadius;
      for (const pin of game.pins) {
        if (ball.gutter || pin.down || Math.hypot(ball.x - pin.x, ball.z - pin.z) > 0.74) continue;
        const offset = pin.x - ball.x;
        topple(pin, offset * 1.7 + ball.vx * 0.11, 0.83, 1.15 + ball.vz * 0.15, "impact", events);
        ball.vx -= offset * 0.53;
        ball.vz *= 0.79;
      }
      if (ball.z >= 11.45 || ball.vz < 3.1) {
        game.phase = "settle";
        game.until = game.time + 0.68;
        game.ball = null;
      }
    }

    if (game.phase === "roll" || game.phase === "settle" || game.phase === "celebrate") {
      for (const pin of game.pins) {
        if (!pin.down || pin.fall >= 1 && Math.hypot(pin.vx, pin.vz) < 0.03) continue;
        pin.fall = Math.min(1, pin.fall + dt * (1.85 + Math.hypot(pin.vx, pin.vz) * 0.3));
        pin.x += pin.vx * dt;
        pin.z += pin.vz * dt;
        pin.vx *= Math.exp(-3.7 * dt);
        pin.vz *= Math.exp(-3.7 * dt);
        const tip = pin.fall * 0.56;
        for (const neighbor of game.pins) {
          if (neighbor.down || pin.fall < 0.20 || Math.hypot(pin.vx, pin.vz) < 0.22) continue;
          if (Math.hypot(pin.x + pin.dx * tip - neighbor.x, pin.z + pin.dz * tip - neighbor.z) >= 0.56) continue;
          topple(neighbor, neighbor.x - pin.x, neighbor.z - pin.z, Math.hypot(pin.vx, pin.vz) * 0.82, "clack", events);
        }
      }
    }

    if (game.phase === "settle" && game.time >= game.until) {
      if (game.hits < 6) { game.phase = "aim"; return; }
      const strike = game.shot === 1;
      game.banner = strike ? "STRIKE !" : game.round === 3 ? "BRAVO !" : "BIEN JOU\u00c9 !";
      game.phase = "celebrate";
      game.until = game.time + 1.48;
      if (game.round === 3 && strike) events.push({ kind: "strike" });
      events.push({ kind: game.round === 3 ? "victory" : strike ? "strike" : "round" });
    } else if (game.phase === "celebrate" && game.time >= game.until) {
      game.banner = null;
      if (game.round === 3) { game.phase = "won"; events.push({ kind: "done" }); return; }
      game.round += 1;
      game.shot = 0;
      game.hits = 0;
      rack();
      game.phase = "aim";
      events.push({ kind: "next" });
    }
  }
  return { game, launch, advance };
}

function bowlingView(w, h) {
  const near = Math.min(w * 0.169, h * 0.61);
  const far = Math.min(w * 0.133, h * 0.305);
  const base = h * 0.91;
  const horizon = h * 0.25;
  const point = (x, z) => {
    const depth = Math.max(0, z) / 11.45;
    const t = 0.55 * depth + 0.45 * (1.62 * depth) / (0.62 + depth);
    const scale = near + (far - near) * t;
    return { x: w / 2 + x * scale, y: base + (horizon - base) * t, scale };
  };
  return { w, h, base, horizon, point };
}

function bowlingPoly(ctx, points, color) {
  ctx.beginPath();
  points.forEach(({ x, y }, i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function bowlingOval(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
}

function bowlingLine(ctx, pts, color, width) {
  ctx.beginPath();
  pts.forEach(({ x, y }, i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawBowlingHall(ctx, { w, h, point, horizon }) {
  const top = ctx.createLinearGradient(0, 0, 0, h);
  top.addColorStop(0, "#35284e");top.addColorStop(0.38, "#182c43");top.addColorStop(1, "#102e39");
  ctx.fillStyle = top;ctx.fillRect(0, 0, w, h);
  const central = point(2.75, 11.45).x - w / 2;
  const rearGlow = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, central * 1.4);
  rearGlow.addColorStop(0,"#634882");rearGlow.addColorStop(1,"#25324b00");
  ctx.fillStyle = rearGlow;ctx.fillRect(0, 0, w, h * 0.64);
  const arch = Math.min(central * 0.96, w * 0.41);
  ctx.strokeStyle = "#c870a6";ctx.lineWidth = 3;
  ctx.beginPath();ctx.ellipse(w / 2, horizon * 0.99, arch, horizon * 0.60, 0, Math.PI, 2 * Math.PI);ctx.stroke();
  ctx.strokeStyle = "#ffd4ac";ctx.lineWidth = 1.4;
  ctx.beginPath();ctx.ellipse(w / 2, horizon * 0.99, arch - 8, horizon * 0.55, 0, Math.PI, 2 * Math.PI);ctx.stroke();

  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : w;
    const back = point(side * 2.74, 11.45);
    const front = point(side * 2.87, 0);
    bowlingPoly(ctx, [{ x: edge, y: horizon * 0.77 }, back, front, { x: edge, y: h }], side < 0 ? "#324a52" : "#374550");
    for (let i = 0; i < 6; i += 1) {
      const at = 0.1 + i * 0.16;
      const z = 11.2 - (i * 1.72);
      const p = point(side * 2.86, z);
      bowlingLine(ctx, [p,{ x: edge, y: p.y - (1 - at) * 65 }], i % 2 ? "#66848752" : "#7296a24b", 2);
    }
    bowlingLine(ctx, [{ x: edge, y: 0 }, { x: back.x + side * 15, y: horizon * 0.70 }], "#fab184", 3);
    bowlingLine(ctx, [{ x: edge, y: h * 0.06 }, { x: back.x + side * 15, y: horizon * 0.77 }], "#74dec9", 2);
    const margin = Math.max(0, Math.min(w * 0.19, Math.abs(back.x - edge) * 0.44));
    if (margin > 27) {
      const x = edge - side * margin;
      const y = horizon * 0.42;
      const bulb = Math.min(margin * 0.37, h * 0.036);
      bowlingOval(ctx, x, y, bulb * 1.75, bulb * 1.35, "#202d44");
      bowlingOval(ctx, x, y, bulb * 1.45, bulb, side < 0 ? "#53c7ac" : "#fc83a6");
      bowlingOval(ctx, x - bulb * .5, y - bulb * .12, bulb * .24, bulb * .31, "#12294b");
      bowlingOval(ctx, x + bulb * .48, y - bulb * .12, bulb * .24, bulb * .31, "#12294b");
    }
  }

  const segment = (a, b, z1, z2, fill) => bowlingPoly(ctx, [point(a,z1),point(b,z1),point(b,z2),point(a,z2)],fill);
  segment(-2.82, 2.82, -1.4, 12.9, "#181e3c");
  for (const side of [-1, 1]) {
    for (const [a, b, color] of [[2.14,2.48,"#445781"],[2.48,2.64,"#263351"],[2.64,2.77,side < 0 ? "#65dbc3" : "#fb91a8"],[2.77,2.83,"#deeacb"]]) {
      segment(side * a, side * b, 0, 11.45, color);
    }
  }
  const wood = ["#ffc575", "#ffdd94", "#ffd386", "#f2b674", "#ffe7a4"];
  for(let i = 0; i < 24; i += 1) {
    const a = -2.14 + i * 4.28 / 24, b = a + 4.28 / 24;
    segment(a, b, 0, 11.47, wood[(i * 7) % wood.length]);
    bowlingLine(ctx, [point(b,0),point(b,11.45)], "#b76c4355", 0.75);
    for (let z = 0.6 + (i % 3) * 0.91; z < 11.45; z += 2.73) {
      bowlingLine(ctx, [point(a,z),point(b,z)],"#ac654455",0.85);
    }
  }
  const glaze = ctx.createLinearGradient(0, horizon, 0, h);
  glaze.addColorStop(0,"#8e527655");glaze.addColorStop(0.26,"#fff6c913");glaze.addColorStop(0.61,"#fffbea58");glaze.addColorStop(1,"#f194452a");
  segment(-2.14, 2.14, 0, 11.45, glaze);
  for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) {
    const z = 2.7 + (1.1 - Math.abs(x)) * 0.6;
    bowlingPoly(ctx,[point(x,z+0.18),point(x-.048,z-.10),point(x+.048,z-.10)],"#9f5846");
  }
  const foul = point(0,0.22).y;
  bowlingLine(ctx,[{x:point(-2.14,0.22).x,y:foul},{x:point(2.14,0.22).x,y:foul}],"#c97456",2.5);
  for(let i=0;i<25;i+=1){
    const t=i/24, x=w*0.08+w*0.84*t;
    const y=horizon*0.12+Math.sin(t*Math.PI)*horizon*0.20;
    bowlingOval(ctx,x,y,Math.min(4,w*.009),Math.min(4,w*.009),["#ffcc87","#ff90ae","#81e5d3","#e7bbff"][i%4]);
  }
}

function drawBowlingMonster(ctx, p, pin, clock, reduced) {
  const size = p.scale * 0.53;
  const [body, shade, shine] = bowlingColors[pin.i];
  const wobble = pin.down ? 0 : reduced ? 0 : Math.sin(clock * 4 + pin.i * 2) * 0.045;
  const fall = (pin.dx < -0.1 ? -1 : 1) * (1.31 + pin.i * 0.037) * pin.fall;
  const blink = !pin.down && !reduced && (clock + pin.i * 0.43) % 5.6 > 5.44;
  bowlingOval(ctx, p.x, p.y, size * (0.49 + pin.fall * 0.38), size * 0.16, "#4e284a56");
  ctx.save();ctx.translate(p.x, p.y);ctx.scale(size, size);ctx.rotate(fall + wobble);
  const paint = ctx.createLinearGradient(-0.55,-1.4,0.53,-0.08);
  paint.addColorStop(0,shine);paint.addColorStop(0.23,body);paint.addColorStop(1,shade);
  for (const side of [-1,1]) {
    ctx.beginPath();ctx.moveTo(side*.24,-1.02);ctx.quadraticCurveTo(side*.39,-1.54,side*.52,-1.39);
    ctx.quadraticCurveTo(side*.57,-1.13,side*.43,-.96);ctx.closePath();ctx.fillStyle=pin.i%2 ? body : shine;ctx.fill();
    if(pin.i%3===2){
      bowlingLine(ctx,[{x:side*.27,y:-1.14},{x:side*.38,y:-1.51}],shade,.048);
      bowlingOval(ctx,side*.39,-1.54,.095,.095,shine);
    }
    bowlingOval(ctx,side*.43,-.26,.16,.13,body);
  }
  ctx.beginPath();ctx.moveTo(-.39,-.06);ctx.bezierCurveTo(-.66,-.19,-.51,-.52,-.44,-.70);
  ctx.bezierCurveTo(-.56,-1.14,-.36,-1.36,0,-1.36);ctx.bezierCurveTo(.42,-1.36,.56,-1.10,.45,-.71);
  ctx.bezierCurveTo(.52,-.54,.67,-.24,.41,-.07);ctx.quadraticCurveTo(0,.025,-.39,-.06);ctx.closePath();
  ctx.fillStyle=paint;ctx.fill();ctx.strokeStyle=shade;ctx.lineWidth=.042;ctx.stroke();
  bowlingLine(ctx,[{x:-.32,y:-.93},{x:-.29,y:-1.07},{x:-.19,y:-1.17}],shine,.055);
  for(const side of [-1,1]){
    const y=-.92+(pin.i%2&&side<0?.04:0);
    bowlingOval(ctx,side*.177,y,.162,blink?.023:.199,"#fff8ea");
    if(!blink){
      bowlingOval(ctx,side*.172+.025,y+.015,.077,pin.down?.105:.091,"#17263c");
      bowlingOval(ctx,side*.172+.01,y-.016,.024,.031,"#fff");
    }
    bowlingOval(ctx,side*.30,-.61,.074,.040,shine);
  }
  if(pin.down) bowlingOval(ctx,0,-.58,.105,.126,"#57274d");
  else{
    ctx.beginPath();ctx.moveTo(-.137,-.62);ctx.quadraticCurveTo(0,-.43,.151,-.62);
    ctx.strokeStyle="#57274d";ctx.lineWidth=.047;ctx.lineCap="round";ctx.stroke();
    bowlingPoly(ctx,[{x:-.06,y:-.555},{x:.022,y:-.538},{x:.001,y:-.613}],"#fff9e9");
  }
  ctx.restore();
}

function drawBowlingBall(ctx, p, spin) {
  const r = p.scale * bowlingBallRadius;
  const y = p.y - r * .87;
  bowlingOval(ctx, p.x + r * .09, p.y+r*.03, r*1.08,r*.22,"#582b4a70");
  const sheen=ctx.createRadialGradient(p.x-r*.30,y-r*.40,r*.06,p.x,y,r);
  sheen.addColorStop(0,"#e5f9ff");sheen.addColorStop(.20,"#6fe7ff");sheen.addColorStop(.52,"#327fdc");
  sheen.addColorStop(.81,"#533fa0");sheen.addColorStop(1,"#221b51");
  bowlingOval(ctx,p.x,y,r,r,sheen);
  ctx.save();ctx.beginPath();ctx.arc(p.x,y,r,0,Math.PI*2);ctx.clip();
  const turn=Math.sin(spin)*r*.60;
  ctx.beginPath();ctx.ellipse(p.x,y+turn*.45,r*.94,r*.37,-.40,0,Math.PI*2);
  ctx.strokeStyle="#aaeaff63";ctx.lineWidth=r*.05;ctx.stroke();
  for(const [x,dy,rx] of [[-.19,-.21,.091],[.12,-.28,.081],[-.03,.13,.123]]){
    bowlingOval(ctx,p.x+x*r,y+(dy*r+turn*.72),r*rx,r*(rx*.72),"#102b60");
  }
  bowlingOval(ctx,p.x-r*.42,y-r*.48,r*.19,r*.10,"#f4fcffac");ctx.restore();
}

let bowlingMusicEnabled = true;

function startMonsterBowling({ dialog, arena, controls, signal, onProgress, onWin }) {
  const {game, launch, advance} = createMonsterBowling();
  const audio = window.SyllabesToonAudio.createArcadeAudio(signal);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  const background = document.createElement("canvas");
  const ctx = canvas.getContext("2d", {alpha:false});
  const backdrop = background.getContext("2d", {alpha:false});
  canvas.className = "monster-bowling-canvas";
  canvas.setAttribute("aria-label", "Piste du Bowling des monstres");
  arena.append(canvas);
  const banner = document.createElement("div");
  banner.className = "monster-bowling-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  arena.append(banner);
  const music = document.createElement("button");
  music.className = "space-bonus-secondary monster-bowling-music";
  music.type = "button";
  music.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/></svg> Musique';
  controls.append(music);
  function updateMusic() {
    music.setAttribute("aria-pressed", String(bowlingMusicEnabled));
    music.title = bowlingMusicEnabled ? "Couper la musique" : "Activer la musique";
    audio.music(bowlingMusicEnabled);
  }
  updateMusic();
  audio.unlock();
  music.addEventListener("click", () => { bowlingMusicEnabled = !bowlingMusicEnabled; updateMusic(); }, { signal });
  dialog.addEventListener("pointerdown", audio.unlock, { signal });
  dialog.addEventListener("keydown", audio.unlock, { signal });

  let view;
  let pixelRatio;
  let drag;
  let aim;
  let frame;
  let last;
  let lastClack = -1;
  let lastImpact = -1;
  const sparks = [];
  let progress = "";
  function updateProgress() {
    const text = `Manche ${game.round}/3 \u00b7 ${game.hits}`;
    if (progress !== text) { progress = text; onProgress(text, "6 monstres"); }
  }

  function cancel() {
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    aim = null;
  }

  function size() {
    const {width, height} = arena.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    if (width <= 0 || height <= 0 || (view?.w === width && view.h === height && pixelRatio === dpr)) return;
    cancel();
    pixelRatio = dpr;
    canvas.width = background.width = Math.round(width * dpr);
    canvas.height = background.height = Math.round(height * dpr);
    backdrop.setTransform(dpr,0,0,dpr,0,0);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    view = bowlingView(width,height);
    drawBowlingHall(backdrop,view);
  }

  const observer = new ResizeObserver(size);
  observer.observe(arena);
  size();
  const pos = (event) => {
    const bounds = canvas.getBoundingClientRect();
    return { x:event.clientX-bounds.left, y:event.clientY-bounds.top };
  };
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag || game.phase !== "aim" || !view) return;
    const p = pos(event), ball = view.point(0,0), r = Math.max(45, ball.scale * 0.84);
    if (Math.hypot(p.x-ball.x,p.y-ball.y+ball.scale*.35)>r) return;
    drag = {...p,id:event.pointerId};
    canvas.setPointerCapture(event.pointerId);
  }, {signal});
  const guide = (event) => {
    const p = pos(event);
    return bowlingAim(p.x-drag.x,p.y-drag.y,view.h);
  };
  canvas.addEventListener("pointermove", (event) => {
    if (drag?.id === event.pointerId) aim = guide(event);
  }, {signal});
  canvas.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    const choice = guide(event);
    cancel();
    if (launch(choice)) { audio.play("launch");audio.play("roll"); }
  }, {signal});
  for (const name of ["pointercancel","lostpointercapture"]) canvas.addEventListener(name,(event)=>{
    if(drag?.id===event.pointerId)cancel();
  },{signal});
  window.addEventListener("blur",cancel,{signal});
  document.addEventListener("visibilitychange",()=>{last=undefined;cancel();},{signal});

  function burst(x,z,i,n) {
    if(reduced.matches) return;
    for(let j=0;j<n;j+=1){
      const angle=(j*2.399+i)*1.1;
      sparks.push({x,z,dx:Math.cos(angle),dy:Math.sin(angle),at:game.time,color:bowlingColors[(i+j)%6][2]});
    }
  }

  function draw() {
    if (!view) return;
    const {w,h,point} = view;
    ctx.drawImage(background,0,0,w,h);
    if (game.phase === "aim") {
      const p = point(0,0), r=p.scale*.54;
      ctx.beginPath();ctx.ellipse(p.x,p.y-r*.28,r*1.16,r*.50,0,0,2*Math.PI);
      ctx.strokeStyle=drag ? "#ffffff" : "#fff4c7";ctx.lineWidth=3;
      ctx.setLineDash([6,6]);ctx.stroke();ctx.setLineDash([]);
      if (aim) {
        const z = 3.2+aim.power*4.4;
        const end = point(aim.angle*z,z), start = point(aim.angle*.8,.8);
        const turn = Math.atan2(end.y-start.y,end.x-start.x);
        bowlingLine(ctx,[start,end],"#3f436c",10);
        bowlingLine(ctx,[start,end],"#fff7bc",5+aim.power*2);
        bowlingPoly(ctx,[end,{x:end.x-23*Math.cos(turn-.53),y:end.y-23*Math.sin(turn-.53)},
          {x:end.x-23*Math.cos(turn+.53),y:end.y-23*Math.sin(turn+.53)}],"#fff7bc");
      }
    }
    const actors = game.pins.map((pin)=>({z:pin.z,draw:()=>drawBowlingMonster(ctx,point(pin.x,pin.z),pin,game.time,reduced.matches)}));
    const ball = game.ball ?? (game.phase === "aim" ? {x:0,z:0,spin:0} : null);
    if(ball) actors.push({z:ball.z,draw:()=>drawBowlingBall(ctx,point(ball.x,ball.z),ball.spin)});
    actors.sort((a,b)=>b.z-a.z).forEach((actor)=>actor.draw());
    for (let i=sparks.length-1;i>=0;i-=1) {
      const spark=sparks[i], age=(game.time-spark.at)/.60;
      if(age>=1 || reduced.matches){sparks.splice(i,1);continue;}
      const p=point(spark.x,spark.z), size=3+(1-age)*5;
      const x=p.x+spark.dx*age*p.scale*.50, y=p.y-p.scale*.38+spark.dy*age*p.scale*.48;
      ctx.globalAlpha=1-age;
      bowlingPoly(ctx,[{x:x-size,y},{x,y:y-size},{x:x+size,y},{x,y:y+size}],spark.color);
      ctx.globalAlpha=1;
    }
  }

  function tick(now) {
    const dt = last === undefined ? 0 : Math.min(.052,(now-last)/1000);
    last=now;
    if (!document.hidden) {
      for (const event of advance(dt)) {
        if (event.kind === "impact" || event.kind === "clack") {
          burst(event.x,event.z,event.i,7);
          if (event.kind==="impact" && game.time-lastImpact>.14) { lastImpact=game.time;audio.play("impact"); }
          if (event.kind==="clack" && game.time-lastClack>.12) { lastClack=game.time;audio.play("clack"); }
        } else if (event.kind === "done") {
          onWin("Bravo ! Les trois manches sont gagn\u00e9es !");
          return;
        } else if (event.kind !== "next") {
          if (event.kind !== "strike" || game.round !== 3) audio.play(event.kind);
          for(let i=0;i<6;i+=1)burst((i-2.5)*.61,8,i,event.kind==="strike"?10:4);
        }
      }
      updateProgress();
      if (game.banner !== (banner.hidden ? null : banner.textContent)) {
        banner.hidden = !game.banner;
        banner.textContent = game.banner || "";
        banner.classList.toggle("is-strike",game.banner==="STRIKE !");
      }
      draw();
    }
    frame=window.requestAnimationFrame(tick);
  }
  signal.addEventListener("abort",()=>{ cancel();observer.disconnect();window.cancelAnimationFrame(frame); },{once:true});
  updateProgress();
  draw();
  frame=window.requestAnimationFrame(tick);
}
