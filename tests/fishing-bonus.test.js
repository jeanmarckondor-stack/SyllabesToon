const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/fishing-bonus.js"), "utf8");
const { bindFishingPointer, createFishingRound, fishingContact, fishingSwim, fishingView } =
  runInNewContext(`${source}\n({bindFishingPointer,createFishingRound,fishingContact,fishingSwim,fishingView})`);

const anchor = { x: 0.41, y: -0.09 };
const landscape = fishingView(1317, 645);
const portrait = fishingView(824, 1135);

function settle(round, view) {
  const events = [];
  for (let loop = 0; loop < 400 && (round.game.line || (round.game.caught === 4 && !round.game.won)); loop += 1) {
    events.push(...round.advance(1 / 120, view));
  }
  assert.equal(round.game.line, null);
  return events;
}

test("seven fish swim continuously at different depths and turn without jumping", () => {
  const round = createFishingRound();
  assert.equal(round.game.fish.length, 7);
  assert.ok(new Set(round.game.fish.map((fish) => fish.art)).size >= 4);
  for (const fish of round.game.fish) {
    let before = fishingSwim(fish, 0);
    const directions = new Set();
    for (let tick = 1; tick < 1600; tick += 1) {
      const point = fishingSwim(fish, tick / 60);
      assert.ok(point.x > 0.1 && point.x < 0.9 && point.y > 0.1 && point.y < 0.86);
      assert.ok(Math.hypot(point.x - before.x, point.y - before.y) < 0.005);
      directions.add(Math.sign(point.direction));
      before = point;
    }
    assert.ok(directions.has(1) && directions.has(-1));
  }
});

test("the hook detects a crossing, not a nearby but missed pass", () => {
  const hook = [{ x: 0.5, y: 0.08 }, { x: 0.5, y: 0.55 }];
  const fish = [{ x: 0.40, y: 0.33 }, { x: 0.64, y: 0.33 }];
  const hit = fishingContact(...hook, ...fish, 0.05, 0.04);
  assert.ok(hit > 0 && hit < 1);
  assert.equal(fishingContact(...hook, { x: 0.56, y: 0.31 }, { x: 0.6, y: 0.31 }, 0.05, 0.04), null);
});

test("a shallow miss returns automatically, and rotation preserves the current cast", () => {
  const round = createFishingRound();
  assert.ok(round.launch({ x: 0.065, y: 0.075 }, anchor));
  assert.equal(round.launch({ x: 0.85, y: 0.68 }, anchor), false);
  round.advance(0.52, landscape);
  assert.equal(round.game.line.aim.x, 0.065);
  assert.ok(Math.abs(round.game.line.x - 0.065) < 0.007);
  assert.ok(round.game.line.y > 0 && round.game.line.y <= 0.075);
  const events = settle(round, portrait);
  assert.deepEqual(events.map(({ kind }) => kind), ["miss"]);
  assert.equal(round.game.caught, 0);
  assert.ok(round.launch({ x: 0.935, y: 0.08 }, anchor));
});

test("four distinct catches reel in, release and win without granting a catch on the cast", () => {
  for (const view of [landscape, portrait]) {
    const round = createFishingRound();
    const loaded = new Set();
    assert.ok(round.launch({ x: 0.065, y: 0.075 }, anchor));
    settle(round, view);
    for (let i = 0; i < 4; i += 1) {
      const target = round.game.fish.find((fish) => fish.status === "swim");
      const ahead = fishingSwim(target, round.game.time + 0.36 + target.y / 0.86);
      assert.ok(round.launch({ x: ahead.x, y: ahead.y + 0.035 }, anchor));
      let encounter;
      for (let step = 0; step < 160 && !encounter; step += 1) {
        encounter = round.advance(1 / 120, view).find(({ kind }) => kind === "hook");
      }
      assert.equal(round.game.line.phase, "reel");
      assert.equal(round.game.caught, i);
      assert.ok(encounter && !loaded.has(encounter.id));
      const before = round.game.line.y;
      round.advance(0.14, view);
      assert.ok(round.game.line.y < before);
      const events = settle(round, view);
      const releases = events.filter(({ kind }) => kind === "land");
      assert.equal(releases.length, 1);
      assert.equal(releases[0].id, encounter.id);
      assert.equal(round.game.caught, i + 1);
      assert.equal(events.some(({ kind }) => kind === "win"), i === 3);
      loaded.add(encounter.id);
      assert.notEqual(round.game.fish[encounter.id].status, "swim");
    }
    assert.equal(round.game.won, true);
    assert.ok(round.game.fish.filter((fish) => fish.status === "free").length >= 4);
    assert.equal(round.launch({ x: 0.8, y: 0.8 }, anchor), false);
  }
});

test("a tap casts, mouse and touch drags steer, cancellation and abort do not cast", () => {
  class Canvas extends EventTarget {
    getBoundingClientRect() { return { left: 10, top: 20 }; }
    setPointerCapture(id) { this.id = id; }
    hasPointerCapture(id) { return this.id === id; }
    releasePointerCapture() { this.id = null; }
  }
  const canvas = new Canvas();
  const abort = new AbortController();
  const launches = [];
  let aim;
  let view = landscape;
  const cancel = bindFishingPointer(canvas, { signal: abort.signal, view: () => view, canAim: () => true,
    showAim: (position) => { aim = position; }, cast: (position) => launches.push(position) });
  const send = (name, id, type, x, y) => canvas.dispatchEvent(Object.assign(new Event(name), {
    button: 0, pointerId: id, pointerType: type, clientX: x, clientY: y,
  }));
  send("pointerdown", 1, "touch", 282, 65);
  send("pointerup", 1, "touch", 282, 65);
  assert.equal(launches.length, 0);
  send("pointerdown", 1, "touch", 282, 580);
  send("pointerup", 1, "touch", 282, 580);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].x, 272 / landscape.width);
  send("pointerdown", 2, "mouse", 222, 470);
  send("pointermove", 2, "mouse", 885, 535);
  assert.equal(aim.x, 875 / landscape.width);
  send("pointerup", 2, "mouse", 885, 535);
  assert.ok(launches[1].x > launches[0].x && launches[1].y < launches[0].y);
  send("pointerdown", 3, "touch", 900, 525);
  send("pointercancel", 3, "touch", 900, 525);
  assert.equal(aim, null);
  send("pointerdown", 4, "mouse", 325, 590);
  view = portrait;
  cancel();
  send("pointerup", 4, "mouse", 351, 650);
  assert.equal(launches.length, 2);
  send("pointerdown", 5, "touch", 300, 750);
  abort.abort();
  send("pointerup", 5, "touch", 300, 750);
  assert.equal(launches.length, 2);
  assert.equal(canvas.id, null);
});
