const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/funny-golf.js"), "utf8");
const { golfCourses, golfSuggestedAim, advanceGolfBall, hitGolfBall, golfCupRadius } = runInNewContext(
  `${source}\n({ golfCourses, golfSuggestedAim, advanceGolfBall, hitGolfBall, golfCupRadius });`,
);
const start = (course) => ({ ...course.start, vx: 0, vy: 0 });

function finishShot(ball, course, step = () => {}) {
  for (let i = 0; i < 360; i += 1) {
    const result = advanceGolfBall(ball, course, 1 / 60);
    step(ball);
    if (result !== "rolling") return result;
  }
  assert.fail("Ball did not come to rest");
}

test("the suggested shots make all three courses reachable", () => {
  for (const [i, course] of golfCourses.entries()) {
    const ball = start(course);
    let result;
    for (let shot = 0; shot < (i === 0 ? 1 : 2); shot += 1) {
      assert.equal(hitGolfBall(ball, golfSuggestedAim(course, ball)), true);
      result = finishShot(ball, course);
    }
    assert.equal(result, "cup");
    assert.ok(Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y) <= golfCupRadius);
  }
});

test("a wall redirects the ball without counting the hole", () => {
  const course = golfCourses[1];
  const ball = start(course);
  hitGolfBall(ball, { x: 279, y: 100 });
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
  hitGolfBall(ball, course.cup);
  let bounced = false;
  assert.equal(finishShot(ball, course, (b) => { bounced ||= b.vx < -1; }), "stopped");
  assert.equal(bounced, true);

  const straight = golfCourses[0];
  const nearMiss = { x: straight.cup.x - 45, y: straight.cup.y + golfCupRadius + 2, vx: 0, vy: 0 };
  hitGolfBall(nearMiss, { x: straight.cup.x + 45, y: nearMiss.y });
  assert.equal(finishShot(nearMiss, straight), "stopped");
});
