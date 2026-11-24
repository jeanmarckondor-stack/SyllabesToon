const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/funny-golf.js"), "utf8");
const { golfCourses, golfShot, advanceGolfBall, hitGolfBall, golfCupRadius } = runInNewContext(
  `${source}\n({ golfCourses, golfShot, advanceGolfBall, hitGolfBall, golfCupRadius });`,
);
const start = (course) => ({ ...course.start, vx: 0, vy: 0 });
const aimAt = (ball, target) => {
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const distance = Math.hypot(dx, dy);
  const pixels = 9 + 95 * Math.max(0, (distance - 12) / 538) ** (2 / 3);
  return golfShot(dx * pixels / distance, dy * pixels / distance, false);
};

function finishShot(ball, course, step = () => {}) {
  for (let i = 0; i < 360; i += 1) {
    const result = advanceGolfBall(ball, course, 1 / 60);
    step(ball);
    if (result !== "rolling") return result;
  }
  assert.fail("Ball did not come to rest");
}

test("a forward swipe follows its direction, with bounded, increasing power and a dead zone", () => {
  assert.equal(golfShot(0, 0, false), null);
  assert.equal(golfShot(5, 3, false), null);
  const short = golfShot(24, 0, false);
  const middle = golfShot(62, 0, false);
  const long = golfShot(140, 0, false);
  assert.ok(short.distance < middle.distance && middle.distance < long.distance);
  assert.equal(golfShot(280, 0, false).distance, long.distance);
  const upInPortrait = golfShot(0, -62, true);
  assert.ok(upInPortrait.dx > 0 && upInPortrait.dy === 0);
  const ball = start(golfCourses[0]);
  assert.equal(hitGolfBall(ball, null), false);
  assert.equal(hitGolfBall(ball, golfShot(-30, -25, false)), true);
  assert.ok(ball.vx < 0 && ball.vy < 0);
  assert.equal(hitGolfBall(ball, long), false);
});

test("manually aimed gestures make all three courses reachable", () => {
  for (const [i, course] of golfCourses.entries()) {
    const ball = start(course);
    let result;
    const route = i === 0 ? [course.cup] : [
      i === 1 ? { x: 570, y: 318 } : { x: 358, y: 146 }, course.cup,
    ];
    for (const target of route) {
      assert.equal(hitGolfBall(ball, aimAt(ball, target)), true);
      result = finishShot(ball, course);
    }
    assert.equal(result, "cup");
    assert.ok(Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y) <= golfCupRadius);
  }
});

test("a wall redirects the ball without counting the hole", () => {
  const course = golfCourses[1];
  const ball = start(course);
  hitGolfBall(ball, aimAt(ball, { x: 279, y: 100 }));
  let bounced = false;
  const result = finishShot(ball, course, (b) => {
    bounced ||= b.vy > 1;
    assert.ok(b.y >= 235);
  });
  assert.equal(bounced, true);
  assert.equal(result, "stopped");
});

test("the windmill blocks direct shots and near misses do not sink", () => {
  const course = golfCourses[2];
  const ball = start(course);
  hitGolfBall(ball, aimAt(ball, course.cup));
  let bounced = false;
  assert.equal(finishShot(ball, course, (b) => { bounced ||= b.vx < -1; }), "stopped");
  assert.equal(bounced, true);

  const straight = golfCourses[0];
  const nearMiss = { x: straight.cup.x - 45, y: straight.cup.y + golfCupRadius + 2, vx: 0, vy: 0 };
  hitGolfBall(nearMiss, aimAt(nearMiss, { x: straight.cup.x + 45, y: nearMiss.y }));
  assert.equal(finishShot(nearMiss, straight), "stopped");
});
