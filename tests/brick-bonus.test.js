const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/brick-bonus.js"), "utf8");
const { brickSweep, brickView, createBrickRound, bindBrickControls } = runInNewContext(
  `${source}\n({brickSweep,brickView,createBrickRound,bindBrickControls})`);

function moving(round, state) {
  round.game.phase = "play";
  Object.assign(round.game.ball, state);
}

test("a swept circle hits the rounded corner, but not the empty part of its square bounds", () => {
  const box = { x: 50, y: 50, w: 70, h: 28 };
  const hit = brickSweep({ x: 0, y: 41, vx: 3000, vy: 0, r: 13 }, box, 0.07);
  assert.ok(hit.t > 0 && hit.nx < 0 && hit.ny < 0);
  assert.ok(Math.abs(Math.hypot(hit.nx, hit.ny) - 1) < 1e-8);
  assert.equal(brickSweep({ x: 0, y: 36.9, vx: 3000, vy: 0, r: 13 }, box, 0.07), null);
});

test("simultaneous side and ceiling hits rebound on both axes; shallow angles are bounded", () => {
  const round = createBrickRound();
  moving(round, { x: 23, y: 23, vx: -350, vy: -350 });
  const hits = round.advance(0.06);
  assert.equal(hits.filter(({ kind }) => kind === "wall").length, 1);
  assert.ok(round.game.ball.vx > 0 && round.game.ball.vy > 0);
  assert.ok(round.game.ball.x > 13 && round.game.ball.y > 13);
  moving(round, { x: 16, y: 320, vx: -440, vy: -2 });
  round.advance(0.021);
  assert.ok(round.game.ball.vx > 0);
  assert.ok(Math.abs(round.game.ball.vy) > 100);
  assert.ok(Math.hypot(round.game.ball.vx, round.game.ball.vy) <= 475.0001);
});

test("paddle impacts point left or right from the edges and nearly straight from the center", () => {
  const directions = [-0.8, 0, 0.8].map((offset) => {
    const round = createBrickRound();
    round.steer(342);
    const p = round.paddle();
    moving(round, { x: round.game.center + p.w * offset / 2, y: p.y - 45, vx: 0, vy: 450 });
    const hits = round.advance(0.1);
    assert.ok(hits.some(({ kind }) => kind === "paddle"));
    assert.ok(round.game.ball.vy < 0);
    return round.game.ball.vx;
  });
  assert.ok(directions[0] < -100 && Math.abs(directions[1]) < 35 && directions[2] > 100);
});

test("a fast ball cannot tunnel through a brick or remove two bricks in a simultaneous impact", () => {
  let round = createBrickRound();
  const tile = round.game.bricks.at(-1);
  moving(round, { x: tile.x + tile.w / 2, y: tile.y + tile.h + 50, vx: 0, vy: -13000 });
  assert.equal(round.advance(0.01).find(({ kind }) => kind === "brick").id, tile.id);
  assert.equal(round.game.count, 1);
  assert.ok(round.game.ball.vy > 0);

  round = createBrickRound();
  const [left, right] = round.game.bricks;
  moving(round, { x: (left.x + left.w + right.x) / 2, y: 22, vx: 0, vy: 1300 });
  assert.equal(round.advance(0.047).filter(({ kind }) => kind === "brick").length, 1);
  assert.equal(round.game.count, 1);
  assert.ok(round.game.ball.vy < 0);
});

test("a miss keeps destroyed bricks and re-serves; a collected star widens only temporarily", () => {
  const round = createBrickRound();
  const { game } = round;
  game.bricks[4].alive = false;
  game.count = 1;
  const p = round.paddle();
  game.stars.push({ x: game.center, y: p.y - 23 });
  moving(round, { x: 48, y: game.height - 49, vx: 0, vy: 430 });
  const events = round.advance(0.2);
  assert.ok(events.some(({ kind }) => kind === "miss"));
  assert.ok(events.some(({ kind }) => kind === "star"));
  assert.ok(round.paddle().w > p.w);
  assert.equal(game.phase, "serve");
  round.steer(600);
  assert.equal(game.ball.x, 600);
  assert.ok(game.ball.y < round.paddle().y);
  round.advance(0.6);
  assert.equal(game.phase, "play");
  assert.ok(game.ball.vy < 0);
  assert.equal(game.count, 1);
  assert.equal(game.bricks[4].alive, false);
  game.time = game.wideUntil + 0.0001;
  assert.equal(round.paddle().w, p.w);
});

test("orientation preserves progress and play state; all twelve bricks can be cleared", () => {
  const round = createBrickRound();
  let rotated = false;
  const names = [];
  for (let turn = 0; turn < 4500 && round.game.phase !== "won"; turn += 1) {
    const g = round.game;
    if (!rotated && g.count >= 5 && g.phase === "play") {
      const field = brickView(824, 1120);
      const prior = g.bricks.map(({ alive }) => alive).join();
      round.resize(field.fieldWidth, field.fieldHeight);
      assert.equal(g.bricks.map(({ alive }) => alive).join(), prior);
      assert.equal(g.phase, "play");
      assert.ok(g.ball.x >= g.ball.r && g.ball.x <= g.width - g.ball.r);
      rotated = true;
    }
    if (g.phase === "serve") {
      const tile = g.bricks.filter(({ alive }) => alive).at(-1);
      round.steer(tile.x + tile.w / 2);
    } else if (g.phase === "play" && g.ball.vy > 0) {
      round.steer(g.ball.x > g.width / 2 ? 0 : g.width);
    }
    names.push(...round.advance(0.012).map(({ kind }) => kind));
  }
  assert.ok(rotated);
  assert.equal(round.game.count, 12);
  assert.equal(round.game.phase, "won");
  assert.equal(names.filter((kind) => kind === "brick").length, 11);
  assert.deepEqual(names.slice(-3), ["last", "fanfare", "win"]);
});

test("mouse and touch steer immediately, while keys, rotation and abort release input", () => {
  const dialog = new EventTarget();
  const canvas = new EventTarget();
  const abort = new AbortController();
  const positions = [];
  canvas.setPointerCapture = (id) => { canvas.pointer = id; };
  canvas.hasPointerCapture = (id) => canvas.pointer === id;
  canvas.releasePointerCapture = () => { canvas.pointer = null; };
  const input = bindBrickControls(dialog, canvas, abort.signal, (x) => positions.push(x));
  const send = (node, name, fields) => node.dispatchEvent(Object.assign(new Event(name, { cancelable: true }), fields));
  send(canvas, "pointerdown", { pointerId: 3, pointerType: "touch", button: 0, clientX: 126 });
  send(canvas, "pointermove", { pointerId: 3, pointerType: "touch", clientX: 661 });
  input.cancel();
  send(canvas, "pointermove", { pointerId: 3, pointerType: "touch", clientX: 813 });
  send(canvas, "pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: 318 });
  send(canvas, "pointerup", { pointerId: 1 });
  assert.deepEqual(positions, [126, 661, 318]);
  send(dialog, "keydown", { key: "ArrowRight" });
  assert.equal(input.direction(), 1);
  send(dialog, "keyup", { key: "ArrowRight" });
  send(dialog, "keydown", { key: "ArrowLeft" });
  assert.equal(input.direction(), -1);
  abort.abort();
  assert.equal(input.direction(), 0);
  send(canvas, "pointerdown", { pointerId: 3, button: 0, clientX: 222 });
  assert.equal(positions.length, 3);
});

test("mock audio generates the original loop and seven effects; mute and abort stop their sources", async () => {
  const voices = [], streams = [], contexts = [];
  const param = () => ({setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const node = () => ({
    connect() {}, disconnect() { this.disconnected = true; }, start() { this.started = true; },
    stop(when) { this.stopped = when ?? 0; }, frequency: param(),
  });
  class AudioContext {
    state = "suspended";
    currentTime = 2;
    constructor() { contexts.push(this); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createBuffer(_channels, length) { const data = new Float32Array(length);return { getChannelData: () => data }; }
    createBufferSource() { const track = node();streams.push(track);return track; }
    createOscillator() { const tone = node();voices.push(tone);return tone; }
    resume() { this.state = "running";return Promise.resolve(); }
    close() { this.state = "closed";return Promise.resolve(); }
  }
  const window = { AudioContext };
  runInNewContext(readFileSync(join(__dirname, "../src/audio.js"), "utf8"), { window });
  const abort = new AbortController();
  const arcade = window.SyllabesToonAudio.createArcadeAudio(abort.signal, "bricks");
  arcade.music(true);
  await arcade.unlock();
  assert.equal(contexts.length, 1);
  assert.ok(streams[0].loop && streams[0].started);
  assert.equal(streams[0].buffer.getChannelData(0).length, Math.round(0.395 * 32 * 22050));
  assert.ok(streams[0].buffer.getChannelData(0).some((sample) => Math.abs(sample) > 0.1));
  arcade.music(false);
  assert.equal(streams[0].stopped, 0);
  for (const name of ["wall", "paddle", "brick", "miss", "star", "last", "fanfare"]) arcade.play(`brick-${name}`);
  assert.equal(voices.length, 20);
  assert.ok(voices.every(({ started, stopped }) => started && stopped > 2));
  arcade.music(true);
  abort.abort();
  assert.equal(contexts[0].state, "closed");
  assert.ok(streams.every(({ stopped }) => stopped === 0));
  assert.ok(voices.every(({ stopped, disconnected }) => stopped === 0 && disconnected));
});

test("the shared catalogue offers bricks on video 21 and cycles back on 24, including refused offers", () => {
  class Element extends EventTarget {
    hidden = false;
    open = false;
    textContent = "";
    dataset = {};
    classList = { add() {}, remove() {} };
    nodes = new Map();
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    toggleAttribute() {}
    setAttribute() {}
    focus() {}
    replaceChildren() {}
  }
  const dialog = new Element();
  dialog.querySelector("#spaceBonusGame").hidden = true;
  const document = { createElement: () => dialog, body: { append() {} }, querySelector: () => new Element() };
  const window = new EventTarget();
  window.clearTimeout = () => {};
  window.SyllabesToonAudio = { stopProgressChime() {} };
  const starts = [];
  runInNewContext(readFileSync(join(__dirname, "../src/bonus-games.js"), "utf8"), {
    document, window, AbortController, startBrickBonus: (round) => starts.push(round),
    startSpaceBonus() {}, startCandyMaze() {}, startTurboBike() {}, startFunnyGolf() {}, startMonsterBowling() {}, startFishingBonus() {},
  });
  const bonuses = window.SyllabesToonBonusGames;
  const ids = Array.from(bonuses.catalog, ({ id }) => id);
  assert.deepEqual(ids, ["space", "maze", "bike", "golf", "bowling", "fishing", "bricks"]);
  const names = Array.from(bonuses.catalog, ({ title }) => title);
  for (let video = 1; video <= 24; video += 1) {
    assert.equal(bonuses.rewardClosed(), video % 3 === 0);
    if (video % 3 === 0) {
      assert.equal(dialog.querySelector("#spaceBonusOfferGame").textContent, names[(video / 3 - 1) % names.length]);
      dialog.querySelector("#spaceBonusNo").dispatchEvent(new Event("click"));
      assert.equal(dialog.open, false);
    }
  }
  bonuses.preview("bricks", new Element());
  assert.equal(starts.length, 1);
  dialog.querySelector("#spaceBonusQuit").dispatchEvent(new Event("click"));
  assert.ok(starts[0].signal.aborted);
  let returned = 0;
  assert.ok(bonuses.offerParkourBonus("bricks", new Element(), { complete: () => { returned += 1; } }));
  dialog.querySelector("#spaceBonusYes").dispatchEvent(new Event("click"));
  assert.equal(starts.length, 2);
  dialog.querySelector("#spaceBonusQuit").dispatchEvent(new Event("click"));
  assert.equal(returned, 1);
});
