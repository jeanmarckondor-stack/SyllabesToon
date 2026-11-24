const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(resolve(__dirname, "../src/candy-maze.js"), "utf8");
function maze(globals = {}) {
  return runInNewContext(`${source}\n({ candyMazeMap, candyMazeDirections, candyMazePath, candyMazeKey,
    candyMazeDistances, candyMazeContact, candyMazePosition, candyMazeTiming, candyMazeWallPaths,
    createCandyMazeRound, bindCandyMazePad })`, globals);
}

test("wall contours are closed, all pellets reachable, and the player faces the travelled direction", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  const { distances } = api.candyMazeDistances(round.player);
  assert.equal(distances.size, api.candyMazeMap.join("").replaceAll("#", "").length);
  assert.equal(round.pellets.size, 17);
  assert.ok([...round.pellets].every((key) => distances.has(key)));
  assert.ok(api.candyMazeWallPaths().every((path) => /^M.*Q.*Z$/.test(path)));
  const [up, left, down] = api.candyMazeDirections;
  assert.equal(round.movePlayer(down, 0), false);
  assert.ok(round.movePlayer(up, 100));
  assert.equal(api.candyMazeKey(round.player), "6,2");
  assert.equal(Math.atan2(round.player.dy, round.player.dx) * 180 / Math.PI, -90);
  round.advance(300);
  assert.equal(round.movePlayer(left, 300), false);
});

test("pink takes a shortest route and cyan switches from patrol to a point ahead of the player", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  const [pink, cyan] = round.ghosts;
  const length = (piece, target) => api.candyMazeDistances(target).distances.get(api.candyMazeKey(piece));
  const corner = { x: 12, y: 0 };
  const { pink: pinkMs, cyan: cyanMs } = api.candyMazeTiming;
  assert.deepEqual([pinkMs, cyanMs], [680, 760]);
  for (let step = 1; step <= 4; step += 1) {
    const before = length(pink, round.player);
    assert.equal(round.moveGhost(0, step * pinkMs), true);
    assert.equal(length(pink, round.player), before - 1);
    assert.ok(api.candyMazePath(pink));
    const patrolDistance = length(cyan, corner);
    assert.equal(round.moveGhost(1, step * cyanMs), true);
    assert.equal(length(cyan, corner), patrolDistance - 1);
    assert.ok(api.candyMazePath(cyan));
  }
  const ahead = { x: 8, y: 3 };
  const before = length(cyan, ahead);
  round.moveGhost(1, 5 * cyanMs);
  assert.equal(length(cyan, ahead), before - 1);
  assert.ok(api.candyMazePath(cyan));
});

test("both ghosts glide linearly for their entire cadence and stay between adjacent floor cells", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  for (const [index, delay] of [680, 760].entries()) {
    const ghost = round.ghosts[index];
    const start = api.candyMazeKey(ghost);
    assert.equal(round.moveGhost(index, 100), true);
    assert.equal(ghost.travel.until, 100 + delay);
    assert.equal(api.candyMazeKey(api.candyMazePosition(ghost, 100)), start);
    assert.equal(api.candyMazeKey(api.candyMazePosition(ghost, 100 + delay)), api.candyMazeKey(ghost));
    assert.equal(Math.abs(ghost.dx) + Math.abs(ghost.dy), 1);
    assert.ok(api.candyMazePath(ghost.travel.from) && api.candyMazePath(ghost));
    for (const fraction of [0.25, 0.5, 0.75, 0.99]) {
      const pos = api.candyMazePosition(ghost, 100 + fraction * delay);
      const from = ghost.travel.from;
      assert.ok(Math.abs(Math.hypot(pos.x - from.x, pos.y - from.y) - fraction) < 1e-8);
    }
  }
});

test("swept collisions find an opposing crossing during a missed frame but not a parallel lane", () => {
  const api = maze();
  const piece = (y, dx) => ({ x: dx === 1 ? 1 : 0, y, dx, dy: 0,
    travel: { from: { x: dx === 1 ? 0 : 1, y }, start: 50, until: 175 } });
  const when = api.candyMazeContact(piece(0, 1), piece(0, -1), 0, 250);
  assert.ok(when > 50 && when < 112.5);
  assert.equal(api.candyMazeContact(piece(0, 1), piece(1, -1), 0, 250), null);
});

test("a player reaching a ghost freezes once; resetting restores the entire board and the controls", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  const [up, left, down] = api.candyMazeDirections;
  [up, up, up, down, down, down].forEach((dir, i) => {
    assert.ok(round.movePlayer(dir, i * 200));
    round.advance(i * 200 + 125);
  });
  assert.equal(round.collected, 1);
  Object.assign(round.ghosts[0], { x: 5, y: 3 });
  assert.ok(round.movePlayer(left, 1200));
  assert.equal(round.advance(1200), null);
  assert.equal(round.advance(1270).caught.index, 0);
  assert.equal(api.candyMazeKey(round.ghosts[0]), "5,3");
  assert.equal(round.advance(1300), null);
  assert.equal(round.movePlayer(down, 1400), false);
  assert.equal(round.moveGhost(1, 1500), false);
  assert.equal(round.collected, 1);
  round.reset(2200);
  assert.equal(round.collected, 0);
  assert.equal(round.caught, null);
  assert.equal(round.pellets.size, 17);
  assert.ok(round.pellets.has("6,0"));
  assert.equal(api.candyMazeKey(round.player), "6,3");
  assert.equal(round.ghosts.map(api.candyMazeKey).join(";"), "0,1;12,7");
  assert.ok(round.ghosts.every((ghost) => ghost.steps === 0 && ghost.waypoint === 0 && !ghost.travel));
  assert.ok(round.movePlayer(up, 2200));
});

test("a ghost reaches the player before the end of its travel, and a contact beats the eighth pellet", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  Object.assign(round.ghosts[0], { x: 5, y: 3 });
  assert.ok(round.moveGhost(0, 0));
  assert.equal(round.advance(190), null);
  assert.equal(round.advance(320).caught.index, 0);
  assert.ok(round.caught.at < round.ghosts[0].travel.until);

  round.reset(400);
  Object.assign(round.player, { x: 6, y: 1 });
  Object.assign(round.ghosts[0], { x: 6, y: 0 });
  round.collected = 7;
  assert.ok(round.movePlayer(api.candyMazeDirections[0], 400));
  assert.equal(round.advance(525).caught.index, 0);
  assert.equal(round.won, false);
  assert.equal(round.collected, 7);
  assert.ok(round.pellets.has("6,0"));
});

test("the last pellet wins if the ghost would arrive later in the same frame", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  Object.assign(round.player, { x: 6, y: 1 });
  Object.assign(round.ghosts[0], { x: 5, y: 0 });
  round.collected = 7;
  assert.ok(round.moveGhost(0, 0));
  assert.equal(round.advance(100), null);
  assert.ok(round.movePlayer(api.candyMazeDirections[0], 100));
  assert.ok(api.candyMazeContact(round.player, round.ghosts[0], 225, 300) > 225);
  assert.equal(round.advance(300).pellet, "6,0");
  assert.equal(round.won, true);
  assert.equal(round.caught, null);
});

test("playing with both ghosts running can collect eight distinct pellets and win", () => {
  const api = maze();
  const round = api.createCandyMazeRound();
  const timing = api.candyMazeTiming;
  const cadences = [timing.pink, timing.cyan];
  const next = [...cadences];
  const collected = new Set();
  const route = "HHHDDBBDDBBBBGGHGGBBBGGHHGGHH";

  function advance(at) {
    const pellet = round.advance(at)?.pellet;
    assert.equal(round.caught, null);
    if (pellet !== undefined) {
      assert.ok(!collected.has(pellet));
      collected.add(pellet);
      assert.ok(!round.pellets.has(pellet));
    }
  }
  for (let i = 0; i <= route.length; i += 1) {
    const now = i * 175;
    while (Math.min(...next) <= now) {
      const due = Math.min(...next);
      const ghost = next.indexOf(due);
      advance(due);
      round.moveGhost(ghost, due);
      next[ghost] += cadences[ghost];
    }
    advance(now);
    if (round.won) break;
    const direction = api.candyMazeDirections.find(({ name }) => name[0] === route[i]);
    assert.ok(round.movePlayer(direction, now));
  }
  assert.equal(round.won, true);
  assert.equal(round.collected, 8);
  assert.equal(collected.size, 8);
  assert.equal(round.pellets.size, 9);
  assert.equal(round.moveGhost(0, 10000), false);
  assert.equal(round.movePlayer(api.candyMazeDirections[0], 10000), false);
});

test("touch and arrow keys repeat only while held, and cancellation/abort clear pending input", () => {
  const pending = new Map();
  let seq = 0;
  class Element extends EventTarget {
    classList = new Set();
    dataset = {};
    children = [];
    constructor() {
      super();
      this.classList.remove = this.classList.delete.bind(this.classList);
    }
    get firstElementChild() { return this.children[0]; }
    append(child) { this.children.push(child); }
    focus() {}
    setAttribute() {}
    setPointerCapture(pointer) { this.pointer = pointer; }
    releasePointerCapture() { this.pointer = null; }
    hasPointerCapture(pointer) { return this.pointer === pointer; }
  }
  const window = new EventTarget();
  window.setTimeout = (callback, delay) => { pending.set(++seq, { callback, delay }); return seq; };
  window.clearTimeout = (id) => pending.delete(id);
  const document = new EventTarget();
  document.createElement = () => new Element();
  const { bindCandyMazePad, candyMazeTiming } = maze({ window, document });
  const dialog = new Element();
  const pad = new Element();
  const abort = new AbortController();
  const inputs = [];
  const send = (node, kind, properties) => node.dispatchEvent(Object.assign(new Event(kind, { cancelable: true }), properties));
  function tick(expectedDelay) {
    assert.equal(pending.size, 1);
    const [[id, timer]] = pending;
    assert.equal(timer.delay, expectedDelay);
    pending.delete(id);
    timer.callback();
  }
  const setBlocked = bindCandyMazePad(dialog, pad, abort.signal, ({ key }) => inputs.push(key));
  const right = pad.children[3];
  send(right, "pointerdown", { button: 0, pointerId: 1 });
  assert.deepEqual(inputs, ["ArrowRight"]);
  tick(candyMazeTiming.repeatDelay);
  tick(candyMazeTiming.repeat);
  send(window, "pointerup", { pointerId: 1 });
  send(right, "click", { detail: 1 });
  assert.equal(inputs.length, 3);
  assert.equal(pending.size, 0);
  send(dialog, "keydown", { key: "ArrowLeft", repeat: false });
  send(dialog, "keydown", { key: "ArrowLeft", repeat: true });
  tick(candyMazeTiming.repeatDelay);
  assert.deepEqual(inputs.slice(3), ["ArrowLeft", "ArrowLeft"]);
  send(window, "keyup", { key: "ArrowLeft" });
  assert.equal(pending.size, 0);
  send(right, "pointerdown", { button: 0, pointerId: 2 });
  send(window, "pointercancel", { pointerId: 2 });
  assert.equal(pending.size, 0);
  send(right, "pointerdown", { button: 0, pointerId: 3 });
  setBlocked(true);
  const blockedCount = inputs.length;
  assert.equal(pending.size, 0);
  send(dialog, "keydown", { key: "ArrowLeft", repeat: false });
  assert.equal(inputs.length, blockedCount);
  setBlocked(false);
  send(right, "pointerdown", { button: 0, pointerId: 4 });
  assert.equal(inputs.length, blockedCount + 1);
  abort.abort();
  assert.equal(pending.size, 0);
  assert.ok(pad.children.every((button) => button.disabled));
});
