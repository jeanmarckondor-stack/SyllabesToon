function startCandyMaze({ dialog, arena, controls, signal, onProgress, onWin }) {
  const map = [
    ".......",
    ".##.#..",
    ".......",
    "..#.##.",
    ".......",
  ];
  const directions = [
    { key: "ArrowUp", name: "Haut", arrow: "↑", dx: 0, dy: -1 },
    { key: "ArrowLeft", name: "Gauche", arrow: "←", dx: -1, dy: 0 },
    { key: "ArrowDown", name: "Bas", arrow: "↓", dx: 0, dy: 1 },
    { key: "ArrowRight", name: "Droite", arrow: "→", dx: 1, dy: 0 },
  ];
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
  const sweet = `
    <path d="M14 24 5 18q-3 9 0 20l9-5m28-9 9-6q3 9 0 20l-9-5" fill="var(--candy-wrapper)" stroke="#211936" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="m7 25 6 3-6 3m42-6-6 3 6 3" fill="none" stroke="var(--candy-glint)" stroke-width="2" stroke-linecap="round"/>
    <rect x="11.5" y="9" width="33" height="38" rx="15" fill="var(--candy-fill)" stroke="var(--candy-wrapper)" stroke-width="2"/>
    <path d="M16 20q2-5 8-7m9 30q5-1 7-5" fill="none" stroke="var(--candy-glint)" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="22" cy="25" rx="4.9" ry="6.1" fill="#fffdf6"/><ellipse cx="34" cy="25" rx="4.9" ry="6.1" fill="#fffdf6"/>
    <ellipse cx="23.3" cy="25.7" rx="2.5" ry="3.4" fill="#23172c"/><ellipse cx="35.3" cy="25.7" rx="2.5" ry="3.4" fill="#23172c"/>
    <path d="M23 34q5 6 10 0" fill="none" stroke="#34213f" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M17 34h2m18 0h2" stroke="var(--candy-wrapper)" stroke-width="2.6" stroke-linecap="round"/>`;

  const board = document.createElement("div");
  board.className = "candy-maze-board";
  board.style.setProperty("--columns", map[0].length);
  board.style.setProperty("--rows", map.length);
  board.setAttribute("aria-hidden", "true");
  for (const [index, cell] of Array.from(map.join("")).entries()) {
    const tile = document.createElement("span");
    tile.className = cell === "#" ? "candy-maze-wall" : "candy-maze-path";
    if (cell === "#") {
      const row = map[Math.floor(index / map[0].length)];
      const column = index % row.length;
      tile.classList.toggle("joins-left", row[column - 1] === "#");
      tile.classList.toggle("joins-right", row[column + 1] === "#");
    }
    board.append(tile);
  }
  arena.append(board);

  function sprite(name, x, y, art) {
    const node = document.createElement("div");
    node.className = `candy-maze-sprite ${name}`;
    node.innerHTML = `<svg viewBox="0 0 56 56" focusable="false">${art}</svg>`;
    const piece = { node, x, y };
    place(piece);
    board.append(node);
    return piece;
  }

  function place(piece) {
    piece.node.style.setProperty("--x", piece.x);
    piece.node.style.setProperty("--y", piece.y);
  }

  const player = sprite("candy-maze-player", 3, 2, gourmand);
  const bite = player.node.querySelector(".candy-maze-bite");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const candies = [
    sprite("candy-maze-sweet candy-maze-berry", 2, 0, sweet),
    sprite("candy-maze-sweet candy-maze-mint", 4, 4, sweet),
  ];
  let caught = 0;
  let beat = 0;
  let chomp;
  const reportProgress = () => onProgress(caught, `${candies.length} bonbons`);
  reportProgress();

  function animateStep(dx, dy) {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    player.node.style.setProperty("--maze-facing", `${angle}deg`);
    player.node.dataset.facing = dx < 0 ? "left" : dy < 0 ? "up" : "forward";
    chomp?.cancel();
    if (!reducedMotion.matches) {
      chomp = bite.animate([
        { transform: "scaleY(0.32)" },
        { transform: "scaleY(1)" },
        { transform: "scaleY(0.32)" },
      ], { duration: 180, easing: "ease-in-out" });
    }
  }

  function isPath(x, y) {
    return map[y]?.[x] === ".";
  }

  function movePlayer({ dx, dy }) {
    const x = player.x + dx;
    const y = player.y + dy;
    if (!isPath(x, y)) return;
    player.x = x;
    player.y = y;
    place(player);
    animateStep(dx, dy);
    const candy = candies.find((piece) => !piece.caught && piece.x === x && piece.y === y);
    if (!candy) return;
    candy.caught = true;
    candy.node.classList.add("is-caught");
    caught += 1;
    reportProgress();
    window.SyllabesToonAudio.playProgressChime();
    if (caught === candies.length) onWin("Bravo ! Les deux bonbons sont attrapés !");
  }

  const distanceToPlayer = (x, y) => Math.abs(player.x - x) + Math.abs(player.y - y);
  function flee() {
    beat += 1;
    if (beat % 3 === 0) return;
    for (const candy of candies) {
      if (candy.caught) continue;
      const currentDistance = distanceToPlayer(candy.x, candy.y);
      const neighbors = directions
        .map(({ dx, dy }) => ({ x: candy.x + dx, y: candy.y + dy }))
        .filter(({ x, y }) => isPath(x, y)
          && !candies.some((other) => !other.caught && other.x === x && other.y === y));
      // Patrol at a distance; when chased, wait if there is no way to move farther away.
      const best = currentDistance > 3
        ? neighbors.find(({ x, y }) => x !== candy.previousX || y !== candy.previousY) ?? neighbors[0]
        : neighbors.find(({ x, y }) => distanceToPlayer(x, y) > currentDistance);
      if (!best) continue;
      candy.previousX = candy.x;
      candy.previousY = candy.y;
      candy.x = best.x;
      candy.y = best.y;
      place(candy);
    }
  }

  const pad = document.createElement("div");
  pad.className = "candy-maze-pad";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", "Direction");
  directions.forEach((direction) => {
    const button = document.createElement("button");
    button.className = "space-bonus-primary";
    button.type = "button";
    button.dataset.direction = direction.key;
    button.textContent = direction.arrow;
    button.setAttribute("aria-label", direction.name);
    button.addEventListener("click", () => movePlayer(direction), { signal });
    pad.append(button);
  });
  controls.append(pad);
  pad.firstElementChild.focus({ preventScroll: true });
  dialog.addEventListener("keydown", (event) => {
    const direction = directions.find(({ key }) => key === event.key);
    if (!direction) return;
    event.preventDefault();
    movePlayer(direction);
  }, { signal });
  const timer = window.setInterval(flee, 1050);
  signal.addEventListener("abort", () => {
    window.clearInterval(timer);
    chomp?.cancel();
    for (const button of pad.children) button.disabled = true;
  }, { once: true });
}
