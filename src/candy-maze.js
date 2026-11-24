const candyMazeMap = [
  ".............",
  ".###.#.#.###.",
  ".#...#.#...#.",
  "...#.....#...",
  "##.#.###.#.##",
  "...#.....#...",
  ".#...#.#...#.",
  ".###.#.#.###.",
  ".............",
];
const candyMazeDirections = [
  { key: "ArrowUp", name: "Haut", arrow: "↑", dx: 0, dy: -1 },
  { key: "ArrowLeft", name: "Gauche", arrow: "←", dx: -1, dy: 0 },
  { key: "ArrowDown", name: "Bas", arrow: "↓", dx: 0, dy: 1 },
  { key: "ArrowRight", name: "Droite", arrow: "→", dx: 1, dy: 0 },
];
const candyMazePellets = [
  [1, 0], [6, 0], [11, 0], [0, 2], [3, 2], [9, 2], [12, 2],
  [2, 4], [6, 5], [10, 4], [0, 6], [3, 6], [9, 6], [12, 6],
  [1, 8], [6, 8], [11, 8],
];
const candyMazeGoal = 8;
const candyMazeTiming = { repeatDelay: 255, repeat: 155, playerSlide: 125, pink: 680, cyan: 760, restart: 950 };
const candyMazeGhostCadences = [candyMazeTiming.pink, candyMazeTiming.cyan];
const candyMazeKey = ({ x, y }) => `${x},${y}`;
const candyMazeSame = (a, b) => a?.x === b?.x && a?.y === b?.y;
const candyMazePath = ({ x, y }) => candyMazeMap[y]?.[x] === ".";
const candyMazeStep = (point, { dx, dy }) => ({ x: point.x + dx, y: point.y + dy });
const candyMazeNeighbors = (point) => candyMazeDirections
  .map((direction) => candyMazeStep(point, direction)).filter(candyMazePath);

function candyMazeDistances(target) {
  const distances = new Map([[candyMazeKey(target), 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    for (const neighbor of candyMazeNeighbors(current)) {
      const key = candyMazeKey(neighbor);
      if (distances.has(key)) continue;
      distances.set(key, distances.get(candyMazeKey(current)) + 1);
      queue.push(neighbor);
    }
  }
  return { distances, queue };
}

function candyMazePosition(piece, now) {
  const travel = piece.travel;
  if (!travel || now >= travel.until) return { x: piece.x, y: piece.y };
  const fraction = Math.max(0, (now - travel.start) / (travel.until - travel.start));
  return { x: travel.from.x + piece.dx * fraction, y: travel.from.y + piece.dy * fraction };
}

function candyMazeContact(a, b, start, end) {
  // Sweep each linear segment so a dropped frame cannot miss a crossing.
  const cuts = [a.travel?.start, a.travel?.until, b.travel?.start, b.travel?.until]
    .filter((time) => time > start && time < end).sort((x, y) => x - y);
  cuts.push(end);
  const offset = (time) => {
    const p = candyMazePosition(a, time);
    const q = candyMazePosition(b, time);
    return { x: p.x - q.x, y: p.y - q.y };
  };
  let p = offset(start);
  for (const time of cuts) {
    const distance = p.x ** 2 + p.y ** 2 - 0.62 ** 2;
    if (distance <= 0) return start;
    const q = offset(time);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const speed = dx * dx + dy * dy;
    const dot = p.x * dx + p.y * dy;
    const discriminant = dot * dot - speed * distance;
    if (speed && dot < 0 && discriminant >= 0) {
      const entry = (-dot - Math.sqrt(discriminant)) / speed;
      if (entry >= 0 && entry <= 1) return start + entry * (time - start);
    }
    p = q;
    start = time;
  }
  return null;
}

function createCandyMazeRound(now = 0) {
  const patrol = [{ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 8 }, { x: 12, y: 8 }];
  const round = { reset, advance, movePlayer, moveGhost };
  let sampledAt;
  let arrived;
  reset(now);

  function reset(time) {
    sampledAt = time;
    arrived = true;
    Object.assign(round, {
      player: { x: 6, y: 3, dx: 1, dy: 0 },
      ghosts: [
        { x: 0, y: 1, dx: 0, dy: 1, steps: 0, waypoint: 0 },
        { x: 12, y: 7, dx: 0, dy: -1, steps: 0, waypoint: 0 },
      ],
      pellets: new Set(candyMazePellets.map(([x, y]) => candyMazeKey({ x, y }))),
      collected: 0, caught: null, won: false,
    });
  }

  function move(piece, destination, now, duration) {
    const from = { x: piece.x, y: piece.y };
    Object.assign(piece, destination, { dx: destination.x - from.x, dy: destination.y - from.y,
      travel: { from, start: now, until: now + duration } });
  }

  function advance(time) {
    if (round.caught || round.won) return null;
    const { player, ghosts } = round;
    const arrival = !arrived && player.travel.until <= time;
    const key = arrival ? candyMazeKey(player) : null;
    const finishing = round.collected === candyMazeGoal - 1 && round.pellets.has(key);
    const end = finishing ? player.travel.until : time;
    let caught = null;
    ghosts.forEach((ghost, index) => {
      const at = candyMazeContact(player, ghost, sampledAt, end);
      if (at !== null && (!caught || at < caught.at)) caught = { index, at };
    });
    if (caught) {
      round.caught = caught;
      return { caught };
    }
    sampledAt = time;
    if (!arrival) return null;
    arrived = true;
    if (!round.pellets.delete(key)) return null;
    round.collected += 1;
    round.won = round.collected === candyMazeGoal;
    return { pellet: key };
  }

  function movePlayer(direction, now) {
    const { player } = round;
    const destination = candyMazeStep(player, direction);
    if (round.caught || round.won || !arrived || !candyMazePath(destination)) return false;
    move(player, destination, now, candyMazeTiming.playerSlide);
    arrived = false;
    return true;
  }

  function moveGhost(index, now) {
    if (round.caught || round.won) return false;
    const { player, ghosts } = round;
    const ghost = ghosts[index];
    let target = player;
    if (index === 1) {
      // Cyan alternates a coherent corner patrol with a two-cell lead on the player's direction.
      if (Math.floor(ghost.steps / 4) % 2 === 0) {
        if (candyMazeSame(ghost, patrol[ghost.waypoint])) ghost.waypoint = (ghost.waypoint + 1) % patrol.length;
        target = patrol[ghost.waypoint];
      } else {
        for (let i = 0; i < 2; i += 1) {
          const ahead = candyMazeStep(target, player);
          if (!candyMazePath(ahead)) break;
          target = ahead;
        }
      }
    }
    ghost.steps += 1;

    const { distances } = candyMazeDistances(target);
    const previous = ghost.travel?.from;
    const candidates = candyMazeNeighbors(ghost).filter((point) => !candyMazeSame(point, ghosts[1 - index]));
    const cost = (point) => (distances.get(candyMazeKey(point)) ?? Infinity) + (candyMazeSame(point, previous) ? 0.25 : 0);
    const destination = candidates.reduce((best, point) => !best || cost(point) < cost(best) ? point : best, null);
    const moved = Boolean(destination && !candyMazeSame(ghost, target));
    if (moved) move(ghost, destination, now, candyMazeGhostCadences[index]);
    return moved;
  }
  return round;
}

function candyMazeWallPaths() {
  const edges = new Set();
  const starts = new Map();
  const add = (x, y, dx, dy) => {
    const edge = { x, y, dx, dy };
    const key = candyMazeKey(edge);
    edges.add(edge);
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(edge);
  };
  candyMazeMap.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== "#") return;
    if (candyMazeMap[y - 1]?.[x] !== "#") add(x, y, 1, 0);
    if (row[x + 1] !== "#") add(x + 1, y, 0, 1);
    if (candyMazeMap[y + 1]?.[x] !== "#") add(x + 1, y + 1, -1, 0);
    if (row[x - 1] !== "#") add(x, y + 1, 0, -1);
  }));
  const paths = [];
  while (edges.size) {
    const first = edges.values().next().value;
    const chain = [];
    let edge = first;
    do {
      chain.push(edge);
      edges.delete(edge);
      const corner = candyMazeStep(edge, edge);
      if (candyMazeSame(corner, first)) break;
      const next = starts.get(candyMazeKey(corner)) ?? [];
      // A right turn keeps diagonally touching wall blocks as separate closed contours.
      edge = next.find((e) => edges.has(e) && edge.dx * e.dy - edge.dy * e.dx > 0)
        ?? next.find((e) => edges.has(e));
    } while (edge);
    const point = ({ x, y }, d, scale) => `${x + d.dx * scale},${y + d.dy * scale}`;
    const last = chain.at(-1);
    paths.push(`M${point(first, last, -0.17)}` + chain.map((e, i) =>
      `L${point(e, chain[i - 1] ?? last, -0.17)}Q${e.x},${e.y} ${point(e, e, 0.17)}`).join("") + "Z");
  }
  return paths;
}


function bindCandyMazePad(dialog, pad, signal, playerStep) {
  let held = null;
  let repeatTimer;
  let blocked = false;

  function release() {
    window.clearTimeout(repeatTimer);
    if (!held) return;
    const { button, pointer } = held;
    held = null;
    button.classList.remove("is-held");
    if (pointer !== null && button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
  }

  function begin(direction, button, pointer = null) {
    if (blocked || held?.pointer != null) return;
    release();
    held = { direction, button, pointer };
    button.classList.add("is-held");
    if (pointer !== null) button.setPointerCapture(pointer);
    const repeat = (delay) => {
      playerStep(direction);
      if (held && !signal.aborted) repeatTimer = window.setTimeout(() => repeat(candyMazeTiming.repeat), delay);
    };
    repeat(candyMazeTiming.repeatDelay);
  }

  for (const direction of candyMazeDirections) {
    const button = document.createElement("button");
    button.className = "space-bonus-primary";
    button.type = "button";
    button.dataset.direction = direction.key;
    button.textContent = direction.arrow;
    button.setAttribute("aria-label", direction.name);
    button.addEventListener("pointerdown", (event) => {
      if (event.button === 0) begin(direction, button, event.pointerId);
    }, { signal });
    button.addEventListener("click", (event) => {
      if (!blocked && event.detail === 0) playerStep(direction);
    }, { signal });
    pad.append(button);
  }
  for (const eventName of ["pointerup", "pointercancel"]) window.addEventListener(eventName, (event) => {
    if (held?.pointer === event.pointerId) release();
  }, { signal });
  window.addEventListener("pointermove", (event) => {
    if (held?.pointer === event.pointerId && event.pointerType === "mouse" && !(event.buttons & 1)) release();
  }, { signal });
  for (const eventName of ["blur", "resize"]) window.addEventListener(eventName, release, { signal });
  document.addEventListener("visibilitychange", release, { signal });
  pad.firstElementChild.focus({ preventScroll: true });
  dialog.addEventListener("keydown", (event) => {
    const index = candyMazeDirections.findIndex(({ key }) => key === event.key);
    if (index === -1) return;
    event.preventDefault();
    if (!event.repeat) begin(candyMazeDirections[index], pad.children[index]);
  }, { signal });
  window.addEventListener("keyup", (event) => {
    if (held?.pointer === null && held.direction.key === event.key) release();
  }, { signal });
  function setBlocked(value) {
    blocked = value;
    release();
    for (const button of pad.children) button.disabled = value;
  }
  signal.addEventListener("abort", () => setBlocked(true), { once: true });
  return setBlocked;
}

function startCandyMaze({ dialog, arena, controls, signal, onProgress, onWin }) {
  const gourmand = `
    <mask id="candy-maze-bite-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="56" height="56">
      <rect width="56" height="56" fill="white"/>
      <g class="candy-maze-mouth">
        <path class="candy-maze-bite" d="M28 28 56 10v36Z" fill="black"/>
      </g>
    </mask>
    <g mask="url(#candy-maze-bite-mask)">
      <circle cx="28" cy="28" r="24.5" fill="#ffdf37" stroke="#ffa924" stroke-width="2"/>
      <path d="M10 23a19 19 0 0 1 16-14" fill="none" stroke="#fff2a0" stroke-width="2.8" stroke-linecap="round"/>
      <g class="candy-maze-eye">
        <ellipse cx="29" cy="16" rx="4.2" ry="5.2" fill="#23172c"/>
        <circle cx="30.5" cy="14.4" r="1.25" fill="#fff7cb"/>
      </g>
      <ellipse class="candy-maze-cheek" cx="17" cy="29" rx="4.5" ry="2.9" fill="#ffa04d"/>
    </g>`;
  const ghostArt = `
    <path d="M6 42V27C6 13 15 5 28 5s22 8 22 22v16q0 6-5 6-4 0-6-5-2 6-6 6-4 0-5-6-2 6-6 6-4 0-6-6-2 5-5 5-5 0-5-7Z"
      fill="var(--ghost-fill)" stroke="var(--ghost-edge)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M8 34v8q0 5 4 5 2 0 4-5 3 5 6 6 3 0 6-6 2 6 5 6 4 0 6-6 3 5 6 5 3 0 3-5v-7q-4 6-20 6T8 34Z" fill="var(--ghost-shade)"/>
    <path d="M12 25c1-8 6-13 13-15" fill="none" stroke="var(--ghost-glint)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="20" cy="26" rx="8" ry="9" fill="#fff9f5"/>
    <ellipse cx="36" cy="26" rx="8" ry="9" fill="#fff9f5"/>
    <g class="candy-maze-pupils" fill="#222a57">
      <ellipse cx="20" cy="27" rx="3.7" ry="4.7"/><ellipse cx="36" cy="27" rx="3.7" ry="4.7"/>
      <circle cx="19" cy="25.5" r="1.2" fill="#fff"/><circle cx="35" cy="25.5" r="1.2" fill="#fff"/>
    </g>
    <path d="M24 38q4 5 8 0" fill="none" stroke="#592452" stroke-width="2.2" stroke-linecap="round"/>`;

  const width = candyMazeMap[0].length;
  const height = candyMazeMap.length;
  const board = document.createElement("div");
  board.className = "candy-maze-board";
  board.style.setProperty("--columns", width);
  board.style.setProperty("--rows", height);
  board.setAttribute("aria-hidden", "true");
  const paths = candyMazeWallPaths().map((d) => `<path d="${d}"/>`).join("");
  board.innerHTML = `<svg class="candy-maze-walls" viewBox="0 0 ${width} ${height}" focusable="false">
    <defs><linearGradient id="candyMazeWallShade" x2="0%" y2="100%">
      <stop stop-color="#102344"/><stop offset="1" stop-color="#0a1532"/>
    </linearGradient><g id="candyMazeWallShapes">${paths}</g></defs>
    <use href="#candyMazeWallShapes" fill="url(#candyMazeWallShade)" stroke="#1e4eab" stroke-width=".17"/>
    <use href="#candyMazeWallShapes" fill="none" stroke="#397af4" stroke-width=".095"/>
    <use href="#candyMazeWallShapes" fill="none" stroke="#82c9ff" stroke-width=".026"/>
  </svg>`;
  arena.append(board);

  const round = createCandyMazeRound();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const audio = window.SyllabesToonAudio.createArcadeAudio(signal);
  audio.unlock();
  dialog.addEventListener("pointerdown", audio.unlock, { signal });
  dialog.addEventListener("keydown", audio.unlock, { signal });
  const pad = document.createElement("div");
  pad.className = "candy-maze-pad";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", "Direction");

  function place(node, piece) {
    node.style.setProperty("--x", piece.x);
    node.style.setProperty("--y", piece.y);
  }
  function pieceElement(className, piece, art) {
    const node = document.createElement("div");
    node.className = className;
    if (art) node.innerHTML = `<svg viewBox="0 0 56 56" focusable="false">${art}</svg>`;
    place(node, piece);
    board.append(node);
    return node;
  }

  const pellets = new Map(candyMazePellets.map(([x, y]) => [
    candyMazeKey({ x, y }), pieceElement("candy-maze-pellet", { x, y }),
  ]));
  const player = pieceElement("candy-maze-sprite candy-maze-player", round.player, gourmand);
  const bite = player.querySelector(".candy-maze-bite");
  const ghosts = round.ghosts.map((ghost, i) =>
    pieceElement(`candy-maze-sprite candy-maze-ghost ${i === 0 ? "candy-maze-pink" : "candy-maze-cyan"}`, ghost, ghostArt));
  let chomp;
  let reaction;
  let disappearance;
  let resetTimer;
  let frame;
  let lastFrame;
  let time;
  let nextGhost;
  const poseCache = new WeakMap();

  function playerStep(direction) {
    if (!round.movePlayer(direction, time)) return;
    const { dx, dy } = direction;
    player.style.setProperty("--maze-facing", `${Math.atan2(dy, dx) * 180 / Math.PI}deg`);
    player.dataset.facing = dx < 0 ? "left" : dy < 0 ? "up" : "forward";
    chomp?.cancel();
    if (!motion.matches) chomp = bite.animate([
      { transform: "scaleY(0.36)" }, { transform: "scaleY(1)" }, { transform: "scaleY(0.36)" },
    ], { duration: candyMazeTiming.playerSlide + 26, easing: "ease-in-out" });
  }

  function resolve(until) {
    const result = round.advance(until);
    if (result?.caught) {
      reactToContact(result.caught);
      return false;
    }
    if (result?.pellet) {
      pellets.get(result.pellet).classList.add("is-eaten");
      onProgress(round.collected, `${candyMazeGoal} pastilles`);
      react([{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }]);
      if (!round.won) audio.play("pellet");
      else window.SyllabesToonAudio.playProgressChime();
      if (round.won) {
        renderPose(until);
        onWin("Bravo ! Huit pastilles croqu\u00e9es !");
        return false;
      }
    }
    return true;
  }

  function react(frames) {
    reaction?.cancel();
    if (!motion.matches) reaction = player.querySelector("svg").animate(frames, { duration: 250, easing: "ease-out" });
  }

  function renderPose(at) {
    function renderPiece(node, piece) {
      const point = candyMazePosition(piece, at);
      if (!poseCache.has(node) || !candyMazeSame(point, poseCache.get(node))) {
        place(node, point);
        poseCache.set(node, point);
      }
    }
    renderPiece(player, round.player);
    ghosts.forEach((node, i) => renderPiece(node, round.ghosts[i]));
  }

  function tick(timestamp) {
    if (document.hidden) {
      lastFrame = undefined;
    } else {
      time += lastFrame === undefined ? 0 : Math.max(0, timestamp - lastFrame);
      lastFrame = timestamp;
      while (Math.min(...nextGhost) <= time) {
        const due = Math.min(...nextGhost);
        const i = nextGhost.indexOf(due);
        if (!resolve(due)) return;
        nextGhost[i] += candyMazeGhostCadences[i];
        if (round.moveGhost(i, due)) {
          const ghost = round.ghosts[i];
          ghosts[i].style.setProperty("--look-x", `${ghost.dx * 2.6}px`);
          ghosts[i].style.setProperty("--look-y", `${ghost.dy * 2.4}px`);
        }
      }
      if (!resolve(time)) return;
      renderPose(time);
    }
    frame = window.requestAnimationFrame(tick);
  }

  function reactToContact({ at }) {
    setBlocked(true);
    renderPose(at);
    chomp?.cancel();
    reaction?.cancel();
    board.classList.add("is-caught");
    if (motion.matches) {
      player.style.visibility = "hidden";
    } else {
      disappearance = player.querySelector("svg").animate([
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(0.82, 1.12)", opacity: 1, offset: 0.24 },
        { transform: "scale(0.12)", opacity: 0 },
      ], { duration: 710, easing: "ease-in-out", fill: "forwards" });
    }
    audio.stopEffects();
    audio.play("caught");
    resetTimer = window.setTimeout(restart, candyMazeTiming.restart);
  }

  function restart() {
    const restoreFocus = pad.contains(document.activeElement) || document.activeElement === document.body;
    time = 0;
    lastFrame = undefined;
    nextGhost = [...candyMazeGhostCadences];
    round.reset(time);
    disappearance?.cancel();
    player.style.visibility = "";
    player.style.removeProperty("--maze-facing");
    delete player.dataset.facing;
    for (const pellet of pellets.values()) pellet.classList.remove("is-eaten");
    for (const ghost of ghosts) {
      ghost.style.removeProperty("--look-x");
      ghost.style.removeProperty("--look-y");
    }
    renderPose(time);
    if (board.classList.contains("is-caught")) {
      board.classList.add("is-resetting");
      board.getBoundingClientRect();
      board.classList.remove("is-caught", "is-resetting");
    }
    setBlocked(false);
    if (restoreFocus) pad.firstElementChild.focus({ preventScroll: true });
    onProgress(0, `${candyMazeGoal} pastilles`);
    frame = window.requestAnimationFrame(tick);
  }

  controls.append(pad);
  const setBlocked = bindCandyMazePad(dialog, pad, signal, playerStep);
  document.addEventListener("visibilitychange", () => { lastFrame = undefined; }, { signal });
  signal.addEventListener("abort", () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(resetTimer);
    chomp?.cancel();
    reaction?.cancel();
    disappearance?.cancel();
    board.classList.add("is-idle");
  }, { once: true });
  restart();
}
