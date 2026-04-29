const config = window.SYLLABESTOON_CONFIG;
const syllables = config.syllables;
const levels = config.levels;

const state = {
  levelIndex: 0,
  target: "ma",
  found: 0,
  goal: 1,
  completed: false,
  studentName: "toi",
  started: false,
  targetHistoryByLevel: {},
  targetQueuesByLevel: {},
};

const board = document.querySelector("#cloudBoard");
const targetSyllable = document.querySelector("#targetSyllable");
const feedbackText = document.querySelector("#feedbackText");
const foundCount = document.querySelector("#foundCount");
const goalCount = document.querySelector("#goalCount");
const nextRoundButton = document.querySelector("#nextRound");
const playSoundButton = document.querySelector("#playSound");
const rewardBadge = document.querySelector("#rewardBadge");
const mascotWrap = document.querySelector(".mascot-wrap");
const studentSignName = document.querySelector("#studentSignName");
const startOverlay = document.querySelector("#startOverlay");
const studentNameInput = document.querySelector("#studentName");
const startGameButton = document.querySelector("#startGame");
const levelPicker = document.querySelector("#levelPicker");
const levelName = document.querySelector("#levelName");
const openProgressButton = document.querySelector("#openProgress");
const closeProgressButton = document.querySelector("#closeProgress");
const clearProgressButton = document.querySelector("#clearProgress");
const progressPanel = document.querySelector("#progressPanel");
const progressSummary = document.querySelector("#progressSummary");
const progressDetails = document.querySelector("#progressDetails");
const rewardOverlay = document.querySelector("#rewardOverlay");
const rewardSticker = document.querySelector("#rewardSticker");
const rewardSymbol = document.querySelector("#rewardSymbol");
const rewardTitle = document.querySelector("#rewardTitle");
const rewardMessage = document.querySelector("#rewardMessage");
const closeRewardButton = document.querySelector("#closeReward");
const continueRewardButton = document.querySelector("#continueReward");
const rewardCollection = document.querySelector("#rewardCollection");
let levelButtons = [];
const styleButtons = Array.from(document.querySelectorAll(".style-button"));

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function pickDistractors(target, count, mode) {
  const candidates = getDistractorCandidates(target, mode);
  const fallback = syllables.filter((item) => item !== target);
  const pool = [...new Set([...candidates, ...fallback])];
  const shuffled = shuffle(pool);

  if (shuffled.length >= count) {
    return shuffled.slice(0, count);
  }

  const repeated = [];
  while (repeated.length < count) {
    repeated.push(sample(shuffled));
  }
  return repeated;
}

function getDistractorCandidates(target, mode) {
  const targetFirst = target[0];
  const targetSecond = target[1];
  const targetIsInverse = isVowel(targetFirst) && !isVowel(targetSecond);
  const mixed = syllables.filter((item) => item !== target);

  if (mode === "far") {
    return mixed.filter((item) => item[0] !== targetFirst && item[1] !== targetSecond);
  }

  if (mode === "sameVowel") {
    return mixed.filter((item) => item[1] === targetSecond);
  }

  if (mode === "sameConsonant") {
    return mixed.filter((item) => item[0] === targetFirst);
  }

  if (mode === "sameEnding") {
    return mixed.filter((item) => item[1] === targetSecond);
  }

  if (mode === "inverseFar") {
    return mixed.filter((item) => {
      const itemIsInverse = isVowel(item[0]) && !isVowel(item[1]);
      return itemIsInverse && item[0] !== targetFirst && item[1] !== targetSecond;
    });
  }

  if (mode === "near") {
    if (targetIsInverse) {
      return mixed.filter((item) => item[0] === targetFirst || item[1] === targetSecond);
    }

    return mixed.filter((item) => item[0] === targetFirst || item[1] === targetSecond);
  }

  return mixed;
}

function isVowel(letter) {
  return ["a", "e", "i", "o", "u", "y"].includes(letter);
}

function createRound() {
  const level = levels[state.levelIndex];
  state.target = pickNextTargetForLevel(state.levelIndex);
  state.goal = level.targets;
  state.found = 0;
  state.mistakes = 0;
  state.completed = false;

  targetSyllable.textContent = level.showTarget ? state.target : "?";
  foundCount.textContent = state.found;
  goalCount.textContent = state.goal;
  feedbackText.textContent = `${state.studentName}, écoute bien: trouve ${state.target}.`;
  nextRoundButton.disabled = true;

  const distractorCount = level.totalCards - level.targets;
  const cards = [
    ...Array.from({ length: level.targets }, () => ({ text: state.target, target: true })),
    ...pickDistractors(state.target, distractorCount, level.distractorMode).map((text) => ({ text, target: false })),
  ];

  renderBoard(shuffle(cards), level);
  setTimeout(playTargetSound, 300);
}

function pickNextTargetForLevel(levelIndex) {
  const level = levels[levelIndex];
  const pool = [...new Set(level.targetPool || config.starterSyllables)];
  const levelKey = String(levelIndex);
  const recent = state.targetHistoryByLevel[levelKey] || [];
  const avoidCount = getAvoidCount(pool.length);
  const recentToAvoid = recent.slice(-avoidCount);

  let queue = state.targetQueuesByLevel[levelKey] || [];
  queue = queue.filter((syllable) => pool.includes(syllable));

  if (!queue.length) {
    queue = shuffle(pool);
  }

  let candidateIndex = queue.findIndex((syllable) => !recentToAvoid.includes(syllable));
  if (candidateIndex === -1) {
    queue = shuffle(pool.filter((syllable) => !recentToAvoid.includes(syllable)));
    if (!queue.length) {
      queue = shuffle(pool);
    }
    candidateIndex = 0;
  }

  const [target] = queue.splice(candidateIndex, 1);
  state.targetQueuesByLevel[levelKey] = queue;
  state.targetHistoryByLevel[levelKey] = [...recent, target].slice(-Math.max(avoidCount + 2, 6));
  return target;
}

function getAvoidCount(poolSize) {
  if (poolSize <= 1) {
    return 0;
  }

  if (poolSize <= 3) {
    return 1;
  }

  if (poolSize <= 6) {
    return 2;
  }

  if (poolSize <= 12) {
    return 3;
  }

  return 5;
}

function renderBoard(cards, level) {
  board.innerHTML = "";
  board.className = `cloud-board ${level.density || "comfortable"} count-${cards.length}`;

  cards.forEach((card, index) => {
    const button = document.createElement("button");
    const size = sample(level.sizes);
    const fontVariant = sample(level.fontVariants || ["readable"]);
    const rotation = sample(level.rotations);
    const palette = getPalette(index, level.colorVariety);

    button.type = "button";
    button.className = `syllable-card ${size} font-${fontVariant} palette-${palette}`;
    button.textContent = card.text;
    button.style.setProperty("--rotate", `${rotation}deg`);
    button.dataset.target = String(card.target);
    button.addEventListener("click", () => handleCardClick(button));

    board.appendChild(button);
  });
}

function handleCardClick(button) {
  if (state.completed || button.classList.contains("found")) {
    return;
  }

  if (button.dataset.target === "true") {
    button.classList.add("found");
    state.found += 1;
    foundCount.textContent = state.found;
    feedbackText.textContent = getCorrectMessage();
    showRewardBadge();
    animateMascot("happy");
    speak(state.mistakes ? "Tu as trouvé" : "Bravo");

    if (state.found >= state.goal) {
      completeRound();
    }
    return;
  }

  button.classList.add("soft-miss");
  feedbackText.textContent = sample(config.gentleHelps);
  animateMascot("help");
  maybeShowHint();
  speak(`On cherche ${state.target}`);
  setTimeout(() => button.classList.remove("soft-miss"), 850);
}

function getPalette(index, variety) {
  if (variety === "low") {
    return 3;
  }

  if (variety === "medium") {
    return (index % 3) + 1;
  }

  return (index % 6) + 1;
}

function maybeShowHint() {
  const level = levels[state.levelIndex];
  state.mistakes = (state.mistakes || 0) + 1;

  if (!level.hintAfterMistakes || state.mistakes < level.hintAfterMistakes) {
    return;
  }

  const targetCards = Array.from(board.querySelectorAll('[data-target="true"]:not(.found)'));
  const hintCard = sample(targetCards);
  if (hintCard) {
    hintCard.classList.add("hint");
    setTimeout(() => hintCard.classList.remove("hint"), 1600);
  }
}

function completeRound() {
  state.completed = true;
  recordCompletedRound();
  feedbackText.textContent = `${state.studentName}, ${formatMessage(sample(config.completionMessages)).toLowerCase()}`;
  showRewardBadge();
  showCelebrationReward();
  animateMascot("celebrate");
  nextRoundButton.disabled = false;
  board.classList.add("celebrate");
  speak("Bravo, tu as réussi");
  setTimeout(() => board.classList.remove("celebrate"), 1400);
}

function getCorrectMessage() {
  if (!state.mistakes && state.found === 1) {
    return formatMessage(sample(config.firstTryMessages || config.encouragements));
  }

  if (state.mistakes > 0) {
    return formatMessage(sample(config.comebackMessages || config.encouragements));
  }

  return formatMessage(sample(config.encouragements));
}

function formatMessage(message) {
  return message.replaceAll("{syllable}", state.target);
}

function recordCompletedRound() {
  const level = levels[state.levelIndex];
  window.SyllabesToonStorage.addRecord({
    studentName: state.studentName,
    levelIndex: state.levelIndex,
    levelName: level.name,
    target: state.target,
    found: state.found,
    goal: state.goal,
    mistakes: state.mistakes || 0,
    theme: getCurrentTheme(),
  });
}

function showRewardBadge() {
  rewardBadge.textContent = sample(config.rewardBadges);
  rewardBadge.classList.remove("show");
  window.requestAnimationFrame(() => {
    rewardBadge.classList.add("show");
  });
}

function showCelebrationReward() {
  const reward = sample(config.rewards);
  const unlocked = {
    id: reward.id,
    name: reward.name,
    symbol: reward.symbol,
    className: reward.className,
    studentName: state.studentName,
    target: state.target,
    levelIndex: state.levelIndex,
  };

  window.SyllabesToonStorage.addReward(unlocked);
  renderRewardCollection();

  rewardSticker.className = `reward-sticker ${reward.className}`;
  rewardSymbol.textContent = reward.symbol;
  rewardTitle.textContent = reward.name;
  rewardMessage.textContent = buildRewardMessage();
  rewardOverlay.classList.remove("hidden");
  window.SyllabesToonAudio.playRewardTone(reward.tone);
}

function buildRewardMessage() {
  if (!state.mistakes) {
    return `${state.studentName}, tu as gagné une surprise grâce à ton écoute.`;
  }

  return `${state.studentName}, tu as continué jusqu'à la réussite.`;
}

function closeRewardOverlay() {
  rewardOverlay.classList.add("hidden");
}

function renderRewardCollection() {
  const rewards = window.SyllabesToonStorage.loadRewards().slice(-5);
  rewardCollection.innerHTML = "";

  rewards.forEach((reward) => {
    const item = document.createElement("span");
    item.className = `collection-sticker ${reward.className}`;
    item.textContent = reward.symbol;
    item.title = reward.name;
    rewardCollection.appendChild(item);
  });
}

function animateMascot(mood) {
  mascotWrap.classList.remove("mascot-happy", "mascot-help", "mascot-celebrate");
  window.requestAnimationFrame(() => {
    mascotWrap.classList.add(`mascot-${mood}`);
  });
}

function playTargetSound() {
  window.SyllabesToonAudio.playRecordedOrSpeak({
    syllable: state.target,
    fallbackText: `${state.studentName}, trouve ${state.target}`,
    config,
  });
}

function speak(text) {
  window.SyllabesToonAudio.speak(text);
}

function selectLevel(index) {
  state.levelIndex = index;
  updateLevelDisplay();
  levelButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
  });
  if (state.started) {
    createRound();
  }
}

function updateLevelDisplay() {
  const level = levels[state.levelIndex];
  levelName.textContent = `Niveau ${state.levelIndex + 1} - ${level.name}`;
}

function renderLevelButtons() {
  levelPicker.innerHTML = "";
  levelButtons = levels.map((level, index) => {
    const button = document.createElement("button");
    button.className = "level-button";
    button.type = "button";
    button.dataset.level = String(index);
    button.textContent = String(index + 1);
    button.title = level.name;
    button.setAttribute("aria-label", `Niveau ${index + 1}: ${level.name}`);
    button.addEventListener("click", () => selectLevel(index));
    levelPicker.appendChild(button);
    return button;
  });

  levelButtons[0]?.classList.add("active");
  updateLevelDisplay();
}

styleButtons.forEach((button) => {
  button.addEventListener("click", () => selectTheme(button.dataset.theme));
});

function selectTheme(theme) {
  document.body.classList.remove("theme-candy", "theme-toon", "theme-manga");
  document.body.classList.add(theme);
  styleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === theme);
  });
}

function getCurrentTheme() {
  return config.themes.find((theme) => document.body.classList.contains(theme.id))?.label || "Candy";
}

function openProgressPanel() {
  renderProgressPanel();
  progressPanel.classList.remove("hidden");
}

function closeProgressPanel() {
  progressPanel.classList.add("hidden");
}

function renderProgressPanel() {
  const summary = window.SyllabesToonStorage.summarize();
  progressSummary.innerHTML = "";
  progressDetails.innerHTML = "";

  progressSummary.append(
    createMetric("Manches", summary.totalRounds),
    createMetric("Élèves", summary.students.length),
    createMetric("À revoir", summary.difficultSyllables.filter((item) => item.mistakes > 0).length),
  );

  progressDetails.append(
    createProgressSection("Par élève", renderStudentStats(summary.students)),
    createProgressSection("Syllabes à surveiller", renderSyllableStats(summary.difficultSyllables)),
    createProgressSection("Historique récent", renderRecentRecords(summary.recent)),
  );
}

function createMetric(label, value) {
  const metric = document.createElement("article");
  metric.className = "progress-metric";
  metric.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
  return metric;
}

function createProgressSection(title, content) {
  const section = document.createElement("section");
  section.className = "progress-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading, content);
  return section;
}

function renderStudentStats(students) {
  if (!students.length) {
    return createEmptyProgressText("Aucune séance enregistrée pour l'instant.");
  }

  const list = document.createElement("div");
  list.className = "progress-list";
  students.forEach((student) => {
    const item = document.createElement("p");
    item.innerHTML = `<strong>${student.name}</strong><span>${student.rounds} manche(s), ${student.mistakes} erreur(s)</span>`;
    list.appendChild(item);
  });
  return list;
}

function renderSyllableStats(syllablesStats) {
  const withMistakes = syllablesStats.filter((item) => item.mistakes > 0);
  if (!withMistakes.length) {
    return createEmptyProgressText("Pas encore de syllabe difficile repérée.");
  }

  const list = document.createElement("div");
  list.className = "progress-list";
  withMistakes.forEach((item) => {
    const row = document.createElement("p");
    row.innerHTML = `<strong>${item.syllable}</strong><span>${item.mistakes} erreur(s) sur ${item.rounds} manche(s)</span>`;
    list.appendChild(row);
  });
  return list;
}

function renderRecentRecords(records) {
  if (!records.length) {
    return createEmptyProgressText("Les manches terminées apparaîtront ici.");
  }

  const list = document.createElement("div");
  list.className = "progress-list recent";
  records.forEach((record) => {
    const item = document.createElement("p");
    const date = new Date(record.recordedAt).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    item.innerHTML = `<strong>${record.studentName} - ${record.target}</strong><span>${date}, niveau ${record.levelIndex + 1}, ${record.mistakes} erreur(s)</span>`;
    list.appendChild(item);
  });
  return list;
}

function createEmptyProgressText(text) {
  const empty = document.createElement("p");
  empty.className = "progress-empty";
  empty.textContent = text;
  return empty;
}

function clearProgress() {
  const confirmed = window.confirm("Effacer le suivi local enregistré sur ce navigateur ?");
  if (!confirmed) {
    return;
  }

  window.SyllabesToonStorage.clearRecords();
  renderRewardCollection();
  renderProgressPanel();
}

function startGame() {
  const name = studentNameInput.value.trim();
  state.studentName = name || "toi";
  state.started = true;
  studentSignName.textContent = state.studentName;
  startOverlay.classList.add("hidden");
  createRound();
}

nextRoundButton.addEventListener("click", createRound);
playSoundButton.addEventListener("click", playTargetSound);
startGameButton.addEventListener("click", startGame);
openProgressButton.addEventListener("click", openProgressPanel);
closeProgressButton.addEventListener("click", closeProgressPanel);
clearProgressButton.addEventListener("click", clearProgress);
closeRewardButton.addEventListener("click", closeRewardOverlay);
continueRewardButton.addEventListener("click", closeRewardOverlay);
studentNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startGame();
  }
});

renderLevelButtons();
renderRewardCollection();
studentNameInput.focus();
