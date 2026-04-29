window.SyllabesToonStorage = (() => {
  const STORAGE_KEY = "syllabestoon.sessions.v1";
  const REWARDS_KEY = "syllabestoon.rewards.v1";
  const MAX_RECORDS = 250;

  function loadRecords() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRecords(records) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  }

  function addRecord(record) {
    const records = loadRecords();
    records.push({
      ...record,
      recordedAt: new Date().toISOString(),
    });
    saveRecords(records);
  }

  function clearRecords() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(REWARDS_KEY);
  }

  function loadRewards() {
    try {
      const raw = window.localStorage.getItem(REWARDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function addReward(reward) {
    const rewards = loadRewards();
    rewards.push({
      ...reward,
      unlockedAt: new Date().toISOString(),
    });
    window.localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards.slice(-40)));
  }

  function summarize(records = loadRecords()) {
    const byStudent = new Map();
    const bySyllable = new Map();

    records.forEach((record) => {
      const student = record.studentName || "toi";
      const syllable = record.target || "?";

      if (!byStudent.has(student)) {
        byStudent.set(student, { name: student, rounds: 0, mistakes: 0, found: 0 });
      }
      const studentStats = byStudent.get(student);
      studentStats.rounds += 1;
      studentStats.mistakes += record.mistakes || 0;
      studentStats.found += record.found || 0;

      if (!bySyllable.has(syllable)) {
        bySyllable.set(syllable, { syllable, rounds: 0, mistakes: 0 });
      }
      const syllableStats = bySyllable.get(syllable);
      syllableStats.rounds += 1;
      syllableStats.mistakes += record.mistakes || 0;
    });

    const difficultSyllables = Array.from(bySyllable.values())
      .sort((a, b) => b.mistakes - a.mistakes || b.rounds - a.rounds)
      .slice(0, 5);

    return {
      totalRounds: records.length,
      students: Array.from(byStudent.values()).sort((a, b) => b.rounds - a.rounds),
      difficultSyllables,
      recent: records.slice(-8).reverse(),
    };
  }

  return {
    addRecord,
    addReward,
    clearRecords,
    loadRecords,
    loadRewards,
    summarize,
  };
})();
