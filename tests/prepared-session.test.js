const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "../src/prepared-session.js"), "utf8");
const key = "syllabestoon.preparedSession.v1";

function setup() {
  const entries = Array.from({ length: 11 }, (_, index) => ({
    text: `s${index}`,
    active: index < 10,
    levelIndexes: index < 8 ? [0, 2] : [1, 2],
  }));
  const storage = new Map([["another.setting", "preserved"]]);
  const window = {
    SYLLABESTOON_CONFIG: {
      getSyllables: () => entries,
      levels: [{ totalCards: 8, targets: 2 }, { totalCards: 4, targets: 1 }, { totalCards: 12, targets: 3 }],
    },
    sessionStorage: {
      getItem: (name) => storage.get(name) ?? null,
      setItem: (name, value) => storage.set(name, value),
      removeItem: (name) => storage.delete(name),
    },
  };
  runInNewContext(source, { window });
  return { session: window.SyllabesToonPreparedSession, storage, entries };
}

test("pools include only selected active syllables assigned to that level", () => {
  const { session } = setup();
  const selected = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];
  const levels = session.getLevels([...selected, "s1", "s10", "unknown"]);
  assert.deepEqual([...levels[0].pool], selected);
  assert.deepEqual([...levels[1].pool], []);
  assert.deepEqual([...levels[2].pool], selected);
  assert.deepEqual(Array.from(levels, ({ minimum, playable }) => [minimum, playable]),
    [[7, true], [4, false], [10, false]]);
});

test("start checks level capacity and finish only clears the temporary selection", () => {
  const { session, storage, entries } = setup();
  const originalEntries = JSON.stringify(entries);
  const selected = entries.slice(0, 8).map(({ text }) => text);
  assert.equal(session.read(), null);
  assert.equal(session.start(selected, 2), false);
  assert.equal(storage.has(key), false);
  assert.equal(session.start([...selected, "s0"], 0), true);
  assert.deepEqual(JSON.parse(storage.get(key)), { syllables: selected, levelIndex: 0 });
  assert.equal(session.start(selected, 2), false);
  assert.equal(session.read().levelIndex, 0);
  session.finish();
  assert.equal(session.read(), null);
  assert.equal(storage.get("another.setting"), "preserved");
  assert.equal(JSON.stringify(entries), originalEntries);
});

test("a corrupt or obsolete selection never reopens the normal bank implicitly", () => {
  const { session, storage, entries } = setup();
  storage.set(key, "{bad");
  assert.deepEqual([...session.read().syllables], []);
  storage.set(key, JSON.stringify({ syllables: ["s0", "s1", "s2", "s3", "s4", "s5", "s6"], levelIndex: 0 }));
  assert.equal(session.getLevels(session.read().syllables)[0].playable, true);
  entries[0].active = false;
  assert.equal(session.getLevels(session.read().syllables)[0].playable, false);
  assert.notEqual(session.read(), null);
});
