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
  const targetConsonant = target[0];
  const targetVowel = target[1];
  const mixed = syllables.filter((item) => item !== target);

  if (mode === "far") {
    return mixed.filter((item) => item[0] !== targetConsonant && item[1] !== targetVowel);
  }

  if (mode === "sameVowel") {
    return mixed.filter((item) => item[1] === targetVowel);
  }

  if (mode === "sameConsonant") {
    return mixed.filter((item) => item[0] === targetConsonant);
  }

  if (mode === "near") {
    return mixed.filter((item) => item[0] === targetConsonant || item[1] === targetVowel);
  }

  return mixed;
}

function createRound() {
  const level = levels[state.levelIndex];
  state.target = sample(level.targetPool || config.starterSyllables);
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

function renderBoard(cards, level) {
  board.innerHTML = "";
  board.className = `cloud-board ${level.density || "comfortable"}`;

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
    feedbackText.textContent = sample(config.encouragements);
    showRewardBadge();
    animateMascot("happy");
    speak("Bravo");

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
  feedbackText.textContent = `${state.studentName}, ${sample(config.completionMessages).toLowerCase()}`;
  showRewardBadge();
  animateMascot("celebrate");
  nextRoundButton.disabled = false;
  board.classList.add("celebrate");
  speak("Bravo, tu as réussi");
  setTimeout(() => board.classList.remove("celebrate"), 1400);
}

function showRewardBadge() {
  rewardBadge.textContent = sample(config.rewardBadges);
  rewardBadge.classList.remove("show");
  window.requestAnimationFrame(() => {
    rewardBadge.classList.add("show");
  });
}

function animateMascot(mood) {
  mascotWrap.classList.remove("mascot-happy", "mascot-help", "mascot-celebrate");
  window.requestAnimationFrame(() => {
    mascotWrap.classList.add(`mascot-${mood}`);
  });
}

function playTargetSound() {
  playRecordedSyllableOrSpeak(`${state.studentName}, trouve ${state.target}`, state.target);
}

function playRecordedSyllableOrSpeak(fallbackText, syllable) {
  if (!config.audio.useRecordedVoiceFirst) {
    speak(fallbackText);
    return;
  }

  playFirstAvailableAudio(syllable).catch(() => speak(fallbackText));
}

function playFirstAvailableAudio(syllable) {
  const candidates = config.audio.extensions.map((extension) => {
    return `${config.audio.syllablePath}/${syllable}.${extension}`;
  });

  return tryAudioCandidates(candidates);
}

function tryAudioCandidates(candidates) {
  const [candidate, ...remaining] = candidates;

  if (!candidate) {
    return Promise.reject(new Error("No recorded audio found"));
  }

  return playAudio(candidate).catch(() => tryAudioCandidates(remaining));
}

function playAudio(source) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(source);
    let settled = false;
    const failTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Audio timeout: ${source}`));
      }
    }, 1200);

    audio.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(failTimer);
        reject(new Error(`Audio error: ${source}`));
      }
    });

    audio.play()
      .then(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(failTimer);
          resolve();
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(failTimer);
          reject(error);
        }
      });
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.82;
  utterance.pitch = 1.12;
  window.speechSynthesis.speak(utterance);
}

function selectLevel(index) {
  state.levelIndex = index;
  levelButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
  });
  createRound();
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

function startGame() {
  const name = studentNameInput.value.trim();
  state.studentName = name || "toi";
  studentSignName.textContent = state.studentName;
  startOverlay.classList.add("hidden");
  createRound();
}

nextRoundButton.addEventListener("click", createRound);
playSoundButton.addEventListener("click", playTargetSound);
startGameButton.addEventListener("click", startGame);
studentNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startGame();
  }
});

renderLevelButtons();
studentNameInput.focus();
