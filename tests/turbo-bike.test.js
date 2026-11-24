const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/turbo-bike.js"), "utf8");
const { turboRoad, advanceTurboRide, turboDirection, steerTurboRide } = runInNewContext(
  `${source}\n({ turboRoad, advanceTurboRide, turboDirection, steerTurboRide });`,
);
const startRide = () => ({ x: 0, z: 0, speed: turboRoad.speed, lean: 0, spark: 0, caught: 0, next: 0 });

test("the road bends both ways, the bike moves automatically, and releasing stops steering", () => {
  const centers = Array.from({ length: 190 }, (_, index) => turboRoad.center(index * 3));
  assert.ok(Math.max(...centers) > 2);
  assert.ok(Math.min(...centers) < -2);

  const ride = startRide();
  advanceTurboRide(ride, 0.05, 0);
  assert.ok(ride.z > 0);
  assert.equal(ride.x, 0);
  advanceTurboRide(ride, 0.05, -1);
  const left = ride.x;
  assert.ok(left < 0);
  advanceTurboRide(ride, 0.05, 0);
  assert.equal(ride.x, left);
  advanceTurboRide(ride, 0.05, 1);
  assert.ok(ride.x > left);
});

test("either half responds to a short nudge, and crossing reverses a long hold", () => {
  for (const width of [365, 824, 1317]) {
    const ride = startRide();
    const left = turboDirection(width * 0.25, width);
    const right = turboDirection(width * 0.75, width);
    assert.deepEqual([left, right], [-1, 1]);
    steerTurboRide(ride, 0.11 * left);
    assert.ok(ride.x < 0 && ride.x > -0.2);
    advanceTurboRide(ride, 0.04, left);
    const held = ride.x;
    advanceTurboRide(ride, 0.04, right);
    assert.ok(ride.x > held);
  }
});

test("the shoulder slows the ride gently and the next star remains available after a miss", () => {
  const ride = startRide();
  ride.x = -5;
  for (let i = 0; i < 10; i += 1) advanceTurboRide(ride, 0.05, -1);
  assert.equal(ride.x, -5);
  assert.ok(ride.speed < turboRoad.speed && ride.speed > turboRoad.speed * 0.63);
  for (let i = 0; i < 100 && ride.next === 0; i += 1) advanceTurboRide(ride, 0.05, 0);
  assert.equal(ride.next, 1);
  assert.equal(ride.caught, 0);
  assert.ok(ride.z >= turboRoad.pickup(0).z);
  assert.ok(turboRoad.pickup(ride.next).z > ride.z);
});

test("ordinary steering across the curves can collect six stars", () => {
  const ride = startRide();
  let pickups = 0;
  for (let i = 0; i < 1800 && ride.caught < 6; i += 1) {
    const star = turboRoad.pickup(ride.next);
    const aim = star.z - ride.z < 30 ? star.x : turboRoad.center(ride.z + 8);
    const direction = Math.abs(aim - ride.x) <= 0.1 ? 0 : Math.sign(aim - ride.x);
    if (advanceTurboRide(ride, 1 / 60, direction)) pickups += 1;
  }
  assert.equal(ride.caught, 6);
  assert.equal(ride.caught, pickups);
});
