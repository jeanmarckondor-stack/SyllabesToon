const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { createContext, runInContext } = require("node:vm");

function setup() {
  const entries = [
    { text: "ma", active: true, levelIndexes: [0] },
    { text: "la", active: true, levelIndexes: [0, 1] },
    { text: "ta", active: true, levelIndexes: [0, 1] },
    { text: "ra", active: false, levelIndexes: [0, 1] },
  ];
  const local = new Map();
  const window = {
    localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) },
    SYLLABESTOON_CONFIG: {
      getSyllables: () => entries,
      levels: [{ totalCards: 3, targets: 1 }, { totalCards: 4, targets: 2 }],
      getActiveRewardVideoFiles: () => ["valid", "wrong-manifest-level", "wrong-local-level"],
      getRewardVideoLevelIndexes: (file) => file === "wrong-local-level" ? [1] : null,
    },
  };
  const context = createContext({ window });
  for (const file of ["prepared-session.js", "parkour.js"]) {
    runInContext(readFileSync(join(__dirname, "../src", file), "utf8"), context);
  }
  return { parkours: window.SyllabesToonParkour, local };
}

const definition = (name, count = 1) => ({
  name, priority: "ma",
  blocks: Array.from({ length: count }, () => ({
    modules: Array.from({ length: 3 }, () => ({ levelIndex: 0, video: null })),
    bonus: null,
  })),
});
const videos = [{ file: "valid" }, { file: "inactive" }, { file: "wrong-manifest-level", levels: [1] }, { file: "wrong-local-level" }];
const bonuses = [{ id: "space" }, { id: "golf" }];

test("one- and three-block definitions persist, names normalize, and editing or deleting uses the name key", () => {
  const { parkours, local } = setup();
  parkours.save(definition("  Zoé   Lou  "));
  parkours.save(definition("Rémi", 3));
  assert.equal(parkours.find(" ZOE\u0301   LOU ").name, "Zoé Lou");
  assert.equal(parkours.find("rémi").blocks.length, 3);
  assert.equal(local.size, 1);
  parkours.save(definition("Rémy", 1), parkours.nameKey("Rémi"));
  assert.equal(parkours.find("rémi"), undefined);
  assert.equal(parkours.find("rémy").blocks.length, 1);
  parkours.remove(parkours.nameKey("Zoé Lou"));
  assert.equal(parkours.list().length, 1);
});

test("an invalid or duplicate import cannot replace existing definitions, nor import execution state", () => {
  const { parkours, local } = setup();
  parkours.save(definition("Lina"));
  const before = [...local.values()][0];
  assert.throws(() => parkours.save(definition(" lina ")), /déjà/);
  assert.throws(() => parkours.replace([{ name: "Rémi", blocks: [{ modules: [] }] }]), /trois modules/);
  assert.equal([...local.values()][0], before);
  parkours.replace([{ ...definition("Lina"), phase: "bonus", block: 1, streak: 3 }]);
  assert.deepEqual(Object.keys(parkours.find("Lina")), ["name", "priority", "blocks"]);
});

test("planning never broadens the syllabus or random reward pool, but retains deliberately fixed choices", () => {
  const { parkours } = setup();
  const entry = definition("Lina");
  entry.blocks[0].modules[1].video = "inactive";
  entry.blocks[0].bonus = "golf";
  let plan = parkours.plan(entry, videos, bonuses);
  assert.equal(plan.issues.length, 0);
  assert.deepEqual([...plan.levels[0].pool], ["ma", "la", "ta"]);
  assert.deepEqual(Array.from(plan.blocks[0].modules[0].rewards, (video) => video.file), ["valid"]);
  assert.equal(plan.blocks[0].modules[1].rewards[0].file, "inactive");
  assert.deepEqual([...plan.blocks[0].bonuses], ["golf"]);
  plan = parkours.plan(entry, videos, bonuses, { syllables: ["ma", "la"] });
  assert.equal(plan.levels[0].playable, false);
  assert.match(plan.issues[0], /séance préparée/);
});

test("obsolete media and levels are reported, and priority uses only the second and fourth clean turns", () => {
  const { parkours } = setup();
  const entry = definition("Lina");
  entry.blocks[0].modules[0] = { levelIndex: 12, video: "removed" };
  entry.blocks[0].bonus = "removed";
  const problems = parkours.plan(entry, [], []).issues.join("\n");
  assert.match(problems, /mini-jeu indisponible/);
  assert.match(problems, /niveau 13 indisponible/);
  assert.match(problems, /vidéo indisponible/);
  assert.match(problems, /aucune vidéo active compatible/);
  assert.deepEqual([0, 1, 2, 3, 4].map(parkours.priorityTurn), [false, true, false, true, false]);
});
