function startSpaceBonus({ dialog, arena, controls, signal, onProgress, onWin }) {
  arena.innerHTML = `
    <div id="spaceBonusFleet" class="space-bonus-layer" aria-hidden="true"></div>
    <div id="spaceBonusShots" class="space-bonus-layer" aria-hidden="true"></div>
    <svg id="spaceBonusShip" class="space-bonus-ship" viewBox="0 0 100 76" aria-hidden="true" focusable="false">
      <path d="M39 56q-3 10 11 17 14-7 11-17" fill="#ffc66d" stroke="#172849" stroke-width="4"/>
      <path d="M50 24C33 29 8 42 6 59q17 5 34-4h20q17 9 34 4C92 42 67 29 50 24Z" fill="#8ce7d9" stroke="#172849" stroke-width="4"/>
      <path d="M34 43c0-16 7-28 16-36 9 8 16 20 16 36q0 14-16 17-16-3-16-17Z" fill="#e7f8ff" stroke="#172849" stroke-width="4"/>
      <circle cx="50" cy="35" r="9" fill="#69bbef" stroke="#172849" stroke-width="3"/>
      <path d="M16 54h9m50 0h9" stroke="#fff8ba" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <template id="spaceBonusSaucer">
      <svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">
        <path d="M8 55q42-32 84 0-6 18-42 18T8 55Z" fill="#694dbc" stroke="#241c52" stroke-width="4"/>
        <path d="M25 46v-8a25 25 0 0 1 50 0v8" fill="#baf5ee" stroke="#241c52" stroke-width="4"/>
        <circle cx="41" cy="32" r="3" fill="#242748"/><circle cx="59" cy="32" r="3" fill="#242748"/>
        <path d="M46 38q4 5 8 0" fill="none" stroke="#242748" stroke-linecap="round" stroke-width="2.5"/>
        <ellipse cx="50" cy="53" rx="44" ry="14" fill="var(--saucer-color, #ffaece)" stroke="#241c52" stroke-width="4"/>
        <path d="M25 54h.1m25 4h.1m25-4h.1" stroke="#fff5ae" stroke-width="7" stroke-linecap="round"/>
      </svg>
    </template>
  `;
  controls.innerHTML = '<button id="spaceBonusFire" class="space-bonus-primary" type="button">TIRER</button>';
  const fleet = arena.querySelector("#spaceBonusFleet");
  const shotLayer = arena.querySelector("#spaceBonusShots");
  const ship = arena.querySelector("#spaceBonusShip");
  const saucer = arena.querySelector("#spaceBonusSaucer");
  const fire = controls.querySelector("#spaceBonusFire");
  const audio = window.SyllabesToonAudio;
  const goal = 6;
  const colors = ["#ffaecf", "#75e3e0", "#ffcf72", "#d1b9ff"];
  const resize = new ResizeObserver(measure);
  let frame = null;
  const round = {
    aliens: colors.map((color, index) => {
      const node = document.createElement("div");
      node.className = "space-bonus-saucer";
      node.style.setProperty("--saucer-color", color);
      node.append(saucer.content.cloneNode(true));
      fleet.append(node);
      return { node, lane: 0.17 + index * 0.22, depth: index % 2 ? 0.13 : 0 };
    }),
    shots: [],
    aim: 0.5,
    hits: 0,
    time: 0,
    lastFrame: null,
    lastShot: -Infinity,
    pointer: null,
  };
  onProgress(0, goal);
  measure();
  resize.observe(arena);
  frame = window.requestAnimationFrame(tick);
  fire.focus({ preventScroll: true });

  function place(node, x, y) {
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function moveShip() {
    round.shipX = clamp(round.aim * round.width, round.shipMargin, round.width - round.shipMargin);
    place(ship, round.shipX, round.shipY);
  }

  function measure() {
    if (!arena.clientWidth || !arena.clientHeight) return;
    const { clientWidth: width, clientHeight: height } = arena;
    const previousWidth = round.width;
    const previousHeight = round.height;
    round.width = width;
    round.height = height;
    const shipBox = ship.getBoundingClientRect();
    round.shipMargin = shipBox.width / 2 + 5;
    round.shipHalfHeight = shipBox.height / 2;
    round.shipY = height - round.shipHalfHeight - 7;
    const target = round.aliens[0].node;
    round.saucerHalfWidth = target.offsetWidth / 2;
    round.saucerHalfHeight = target.offsetHeight / 2;
    if (previousWidth && (previousWidth !== width || previousHeight !== height)) {
      for (const shot of round.shots) {
        shot.x *= width / previousWidth;
        shot.y *= height / previousHeight;
      }
    }
    moveShip();
    updateAliens(0);
  }

  function updateAliens(dt) {
    const { width, height, time, saucerHalfWidth, saucerHalfHeight } = round;
    const drift = Math.sin(time * 0.64) * Math.min(width * 0.09, 108);
    const top = saucerHalfHeight + 10;
    const travel = Math.max(0, (height - top - round.shipHalfHeight * 2 - saucerHalfHeight - 24) * 0.78);
    for (const alien of round.aliens) {
      if (alien.hitAt !== undefined) {
        if (time < alien.hitAt + 0.9) continue;
        alien.hitAt = undefined;
        alien.node.classList.remove("is-hit");
      }
      alien.depth = (alien.depth + dt / 22) % 1;
      alien.x = clamp(alien.lane * width + drift, saucerHalfWidth + 4, width - saucerHalfWidth - 4);
      alien.y = top + alien.depth * travel;
      place(alien.node, alien.x, alien.y);
    }
  }

  function shoot() {
    if (round.time - round.lastShot < 0.18) return;
    round.lastShot = round.time;
    const node = document.createElement("span");
    node.className = "space-bonus-shot";
    const x = round.shipX;
    const y = round.shipY - round.shipHalfHeight;
    place(node, x, y);
    shotLayer.append(node);
    round.shots.push({ node, x, y });
  }

  function tick(now) {
    const dt = round.lastFrame === null ? 0 : Math.min((now - round.lastFrame) / 1000, 0.05);
    round.lastFrame = now;
    round.time += dt;
    updateAliens(dt);
    const speed = Math.max(420, round.height * 1.65);
    const { saucerHalfWidth, saucerHalfHeight } = round;
    for (let i = round.shots.length - 1; i >= 0; i -= 1) {
      const shot = round.shots[i];
      const nextY = shot.y - speed * dt;
      // Use the full segment travelled this frame so a fast shot cannot skip a saucer.
      const hit = round.aliens.find((alien) => alien.hitAt === undefined
        && Math.abs(shot.x - alien.x) <= saucerHalfWidth
        && shot.y + 6 >= alien.y - saucerHalfHeight * 0.72
        && nextY - 6 <= alien.y + saucerHalfHeight * 0.72);
      if (hit || nextY < -16) {
        shot.node.remove();
        round.shots.splice(i, 1);
        if (hit && hitSaucer(hit)) return;
      } else {
        shot.y = nextY;
        place(shot.node, shot.x, shot.y);
      }
    }
    frame = window.requestAnimationFrame(tick);
  }

  function hitSaucer(alien) {
    alien.hitAt = round.time;
    alien.depth = 0;
    alien.node.classList.add("is-hit");
    round.hits += 1;
    onProgress(round.hits, goal);
    audio.playProgressChime();
    if (round.hits < goal) return false;
    onWin("Bravo ! Six soucoupes touchées !");
    return true;
  }

  function aimAt(event) {
    round.aim = clamp((event.clientX - arena.getBoundingClientRect().left) / round.width, 0, 1);
    moveShip();
  }

  function releasePointer() {
    if (round.pointer === null) return;
    const pointer = round.pointer;
    round.pointer = null;
    if (arena.hasPointerCapture(pointer)) arena.releasePointerCapture(pointer);
  }

  signal.addEventListener("abort", () => {
    window.cancelAnimationFrame(frame);
    releasePointer();
    resize.disconnect();
    round.shots.length = 0;
    shotLayer.replaceChildren();
    fire.disabled = true;
  }, { once: true });

  fire.addEventListener("click", shoot, { signal });
  arena.addEventListener("pointerdown", (event) => {
    if (round.pointer !== null || event.button !== 0 || event.target.closest("button")) return;
    round.pointer = event.pointerId;
    arena.setPointerCapture(round.pointer);
    aimAt(event);
  }, { signal });
  arena.addEventListener("pointermove", (event) => {
    if (round.pointer === event.pointerId) aimAt(event);
  }, { signal });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    arena.addEventListener(eventName, (event) => {
      if (round.pointer !== event.pointerId) return;
      if (event.type === "pointerup") aimAt(event);
      releasePointer();
    }, { signal });
  }
  dialog.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    round.aim = clamp(round.aim + (event.key === "ArrowLeft" ? -0.055 : 0.055), 0, 1);
    moveShip();
  }, { signal });
}
