window.SyllabesToonPreparedSession = (() => {
  const key = "syllabestoon.preparedSession.v1";
  const config = window.SYLLABESTOON_CONFIG;

  function getLevels(syllables, entries = config.getSyllables()) {
    const selection = new Set(syllables);
    const active = entries.filter((entry) => entry.active && selection.has(entry.text));
    return config.levels.map((level, index) => {
      const pool = active.filter((entry) => entry.levelIndexes.includes(index)).map((entry) => entry.text);
      const minimum = 1 + level.totalCards - level.targets;
      return { pool, minimum, playable: pool.length >= minimum };
    });
  }

  function read() {
    let raw;
    try {
      raw = window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
    if (raw === null) return null;

    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data?.syllables) && data.syllables.every((text) => typeof text === "string")) {
        return { syllables: data.syllables, levelIndex: Number.isInteger(data.levelIndex) ? data.levelIndex : 0 };
      }
    } catch {
      // Fail closed rather than silently changing to the normal syllable bank.
    }
    return { syllables: [], levelIndex: 0 };
  }

  function start(syllables, levelIndex) {
    const selection = [...new Set(syllables)];
    if (!Number.isInteger(levelIndex) || !getLevels(selection)[levelIndex]?.playable) return false;
    window.sessionStorage.setItem(key, JSON.stringify({ syllables: selection, levelIndex }));
    return true;
  }

  function finish() {
    window.sessionStorage.removeItem(key);
  }

  return { getLevels, read, start, finish };
})();
