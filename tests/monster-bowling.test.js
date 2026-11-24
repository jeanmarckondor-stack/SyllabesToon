const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/monster-bowling.js"), "utf8");
const { bowlingAim, bowlingView, createMonsterBowling } = runInNewContext(`${source}\n({bowlingAim,bowlingView,createMonsterBowling})`);

function play(bowling, angle, power) {
  assert.ok(bowling.launch({ angle, power }));
  const events = [];
  for (let i = 0; i < 420 && !["aim", "won"].includes(bowling.game.phase); i += 1) events.push(...bowling.advance(1 / 60));
  assert.ok(["aim", "won"].includes(bowling.game.phase), "each shot settles");
  return events;
}

test("only a forward gesture launches; direction and bounded power affect the moving ball", () => {
  assert.equal(bowlingAim(0, 0, 700), null);
  assert.equal(bowlingAim(4, -14, 700), null);
  assert.equal(bowlingAim(0, 40, 700), null);
  const soft = bowlingAim(-14, -42, 700);
  const strong = bowlingAim(28, -200, 700);
  assert.ok(soft.angle < 0 && strong.angle > 0 && strong.power > soft.power);
  assert.equal(bowlingAim(10000, -3000, 500).angle, 0.32);
  assert.equal(bowlingAim(10000, -3000, 500).power, 1);
  const left = createMonsterBowling(), right = createMonsterBowling();
  assert.equal(left.launch(null), false);
  assert.ok(left.launch(soft) && right.launch(strong));
  assert.equal(left.launch(strong), false);
  left.advance(0.24);right.advance(0.24);
  assert.ok(left.game.ball.x < 0 && right.game.ball.x > 0);
  assert.ok(right.game.ball.z > left.game.ball.z);
});

test("a miss leaves all pins standing; a side impact cannot cause a false strike", () => {
  const bowling = createMonsterBowling();
  assert.deepEqual(play(bowling, 0.29, 0.6), []);
  assert.equal(bowling.game.hits, 0);
  assert.ok(bowling.game.pins.every((pin) => !pin.down));
  const shot = play(bowling, 0.17, 0.55);
  assert.equal(shot.map(({ kind, i }) => `${kind}${i}`).join(), "impact5");
  assert.equal(bowling.game.hits, 1);
  const hit = bowling.game.pins[5];
  play(bowling, 0.29, 0.6);
  assert.ok(hit.down);
  assert.equal(bowling.game.hits, 1);
});

test("a centered strike uses actual domino collisions and all three racks can be completed", () => {
  const bowling = createMonsterBowling();
  for (const round of [1, 2, 3]) {
    assert.equal(bowling.game.round, round);
    assert.equal(bowling.game.shot, 0);
    const events = play(bowling, 0, 0.95);
    const pins = events.filter(({ kind }) => kind === "impact" || kind === "clack");
    assert.equal(new Set(pins.map(({ i }) => i)).size, 6);
    assert.ok(events.some(({ kind }) => kind === "clack"));
    assert.ok(events.some(({ kind }) => kind === "strike"));
    assert.equal(events.some(({ kind }) => kind === "victory"), round === 3);
  }
  assert.equal(bowling.game.phase, "won");
  assert.equal(bowling.launch({ angle: 0, power: 1 }), false);
});

test("orientation changes the projection only; the launch point and pin deck stay on screen", () => {
  const bowling = createMonsterBowling();
  assert.ok(bowling.launch({ angle: 0.075, power: 0.6 }));
  bowling.advance(0.45);
  const original = { ...bowling.game.ball };
  for (const [w, h] of [[1317, 645], [824, 1120], [365, 488]]) {
    const view = bowlingView(w, h);
    const release = view.point(0, 0), deck = view.point(0, 9);
    assert.ok(deck.y < release.y && deck.scale < release.scale);
    assert.equal(release.x, w / 2);
    assert.ok(view.point(2.83, 0).x <= w);
    assert.ok(deck.y > deck.scale * 0.85);
    assert.deepEqual({ ...bowling.game.ball }, original);
  }
});

test("scoped arcade audio resumes the existing context, schedules the full tone and closes its loop", async () => {
  const voices = [];
  const loops = [];
  const contexts = [];
  const param = () => ({setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const sourceNode = () => ({
    connect() {}, disconnect() {}, start(at) { this.started = at ?? 0; },
    stop(at) { this.stopped = at ?? 0; }, frequency: param(),
  });
  class Context {
    state = "suspended";
    currentTime = 3;
    resumeCalls = 0;
    constructor() { contexts.push(this); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() { const voice = sourceNode(); voices.push(voice); return voice; }
    createBufferSource() { const loop = sourceNode(); loops.push(loop); return loop; }
    createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    resume() { this.resumeCalls += 1; this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const window = { AudioContext: Context };
  runInNewContext(readFileSync(join(__dirname, "../src/audio.js"), "utf8"), { window });
  const abort = new AbortController();
  const arcade = window.SyllabesToonAudio.createArcadeAudio(abort.signal);
  await arcade.unlock();
  arcade.play("caught");
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumeCalls, 1);
  assert.equal(voices.length, 6);
  assert.ok(voices.at(-1).stopped - voices[0].started > 0.8);
  arcade.music(true);
  assert.equal(loops.length, 1);
  assert.ok(loops[0].loop);
  assert.ok(loops[0].buffer.getChannelData(0).some((v) => Math.abs(v) > 0.1));
  abort.abort();
  assert.equal(loops[0].stopped, 0);
  assert.equal(contexts[0].state, "closed");
  assert.ok(voices.every((voice) => voice.stopped === 0));
  arcade.play("impact");
  assert.equal(voices.length, 6);
});
