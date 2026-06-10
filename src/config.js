const SYLLABLE_GROUPS = {
  starter: ["ma", "la", "pi", "to", "bu", "se"],
  early: [
    "ma", "me", "mi", "mo", "mu",
    "la", "le", "li", "lo", "lu",
    "pa", "pe", "pi", "po", "pu",
    "ta", "te", "ti", "to", "tu",
    "bu", "se",
  ],
  core: [
    "ma", "me", "mi", "mo", "mu",
    "la", "le", "li", "lo", "lu",
    "pa", "pe", "pi", "po", "pu",
    "ta", "te", "ti", "to", "tu",
    "ba", "be", "bi", "bo", "bu",
    "sa", "se", "si", "so", "su",
    "ra", "re", "ri", "ro", "ru",
    "fa", "fe", "fi", "fo", "fu",
  ],
  extended: [
    "ma", "me", "mi", "mo", "mu",
    "la", "le", "li", "lo", "lu",
    "pa", "pe", "pi", "po", "pu",
    "ta", "te", "ti", "to", "tu",
    "ba", "be", "bi", "bo", "bu",
    "sa", "se", "si", "so", "su",
    "ra", "re", "ri", "ro", "ru",
    "fa", "fe", "fi", "fo", "fu",
    "na", "ne", "ni", "no", "nu",
    "da", "de", "di", "do", "du",
    "va", "ve", "vi", "vo", "vu",
  ],
  inverseEarly: [
    "al", "el", "il", "ol", "ul",
    "am", "em", "im", "om", "um",
  ],
  inverseCore: [
    "al", "el", "il", "ol", "ul",
    "am", "em", "im", "om", "um",
    "ar", "er", "ir", "or", "ur",
    "as", "es", "is", "os", "us",
    "af", "ef", "if", "of", "uf",
  ],
  vowelPairs: [
    "ai", "au", "ei", "eu", "oi", "ou", "ui",
  ],
  vowelTriples: [
    "eau", "oui",
  ],
};

const ALL_SYLLABLES = [
  ...SYLLABLE_GROUPS.extended,
  ...SYLLABLE_GROUPS.inverseCore,
  ...SYLLABLE_GROUPS.vowelPairs,
  ...SYLLABLE_GROUPS.vowelTriples,
];
const SYLLABLES_STORAGE_KEY = "syllabestoon.syllables.v1";
const ACTIVE_SYLLABLES_STORAGE_KEY = "syllabestoon.activeSyllables.v1";
const CUSTOM_SYLLABLES_STORAGE_KEY = "syllabestoon.customSyllables.v1";
const ACTIVE_REWARD_VIDEOS_STORAGE_KEY = "syllabestoon.activeRewardVideos.v1";
const ACTIVE_REWARD_SOUNDS_STORAGE_KEY = "syllabestoon.activeRewardSounds.v1";
const REWARD_VIDEO_LEVELS_STORAGE_KEY = "syllabestoon.rewardVideoLevels.v1";
const MIN_ACTIVE_SYLLABLES = 3;

function getAllSyllables() {
  return getSyllables();
}

function getSyllables() {
  const storedSyllables = readStoredSyllables();
  if (storedSyllables) {
    return storedSyllables;
  }

  const migratedSyllables = migrateSyllables();
  setSyllables(migratedSyllables);
  return migratedSyllables;
}

function setSyllables(syllables) {
  const sanitizedSyllables = sanitizeSyllableEntries(syllables);
  window.localStorage.setItem(SYLLABLES_STORAGE_KEY, JSON.stringify(sanitizedSyllables));
  return sanitizedSyllables;
}

function getActiveSyllables() {
  return getSyllables().filter((entry) => entry.active).map((entry) => entry.text);
}

function getConfiguredActiveSyllables() {
  return getActiveSyllables();
}

function getSyllablesForLevel(levelIndex) {
  return getSyllables().filter((entry) => {
    return entry.active && entry.levelIndexes.includes(levelIndex);
  });
}

function getSyllableTexts() {
  return getSyllables().map((entry) => entry.text);
}

function addSyllable(syllable, levelIndexes = getDefaultLevelIndexes()) {
  const normalized = normalizeSyllable(syllable);
  if (!isValidNewSyllable(normalized)) {
    return null;
  }

  const nextSyllables = [
    ...getSyllables(),
    {
      text: normalized,
      levelIndexes: sanitizeLevelIndexes(levelIndexes, getDefaultLevelIndexes()),
      active: true,
    },
  ];
  setSyllables(nextSyllables);
  return normalized;
}

function deleteSyllable(syllable) {
  const normalized = normalizeSyllable(syllable);
  setSyllables(getSyllables().filter((entry) => entry.text !== normalized));
}

function setSyllableActive(syllable, active) {
  const normalized = normalizeSyllable(syllable);
  return updateSyllable(normalized, (entry) => ({ ...entry, active: Boolean(active) }));
}

function setSyllableLevelIndexes(syllable, levelIndexes) {
  const normalized = normalizeSyllable(syllable);
  const nextLevelIndexes = sanitizeLevelIndexes(levelIndexes, getDefaultLevelIndexes());
  updateSyllable(normalized, (entry) => ({ ...entry, levelIndexes: nextLevelIndexes }));
  return nextLevelIndexes;
}

function updateSyllable(syllable, updater) {
  const nextSyllables = getSyllables().map((entry) => {
    return entry.text === syllable ? updater(entry) : entry;
  });
  setSyllables(nextSyllables);
  return nextSyllables.find((entry) => entry.text === syllable) || null;
}

function readStoredSyllables() {
  try {
    const raw = window.localStorage.getItem(SYLLABLES_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const storedSyllables = JSON.parse(raw);
    if (!Array.isArray(storedSyllables)) {
      return null;
    }

    if (storedSyllables.some((item) => typeof item !== "object" || !("active" in item))) {
      const activeSet = readLegacyActiveSet();
      return sanitizeSyllableEntries(storedSyllables.map((item) => {
        const text = normalizeSyllable(typeof item === "object" && item ? item.text : item);
        return {
          text,
          levelIndexes: typeof item === "object" && item ? item.levelIndexes : getStandardLevelIndexes(text),
          active: activeSet.has(text),
        };
      }));
    }

    return sanitizeSyllableEntries(storedSyllables);
  } catch {
    return null;
  }
}

function migrateSyllables() {
  const activeSet = readLegacyActiveSet();
  const entriesByText = new Map();

  getStandardSyllableTexts().forEach((text) => {
    entriesByText.set(text, {
      text,
      levelIndexes: getStandardLevelIndexes(text),
      active: activeSet.has(text),
    });
  });

  getLegacyCustomSyllableEntries().forEach((entry) => {
    entriesByText.set(entry.text, {
      text: entry.text,
      levelIndexes: entry.levelIndexes,
      active: activeSet.has(entry.text),
    });
  });

  return [...entriesByText.values()];
}

function getLegacyCustomSyllableEntries() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_SYLLABLES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const storedSyllables = JSON.parse(raw);
    if (!Array.isArray(storedSyllables)) {
      return [];
    }

    return storedSyllables
      .map((item) => {
        const text = normalizeSyllable(typeof item === "object" && item ? item.text : item);
        if (!isValidSyllableText(text) || getStandardSyllableTexts().includes(text)) {
          return null;
        }

        return {
          text,
          levelIndexes: sanitizeLevelIndexes(
            typeof item === "object" && item ? item.levelIndexes : getDefaultLevelIndexes(),
            getDefaultLevelIndexes(),
          ),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readLegacyActiveSet() {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SYLLABLES_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const storedSyllables = JSON.parse(raw);
    if (!Array.isArray(storedSyllables)) {
      return new Set();
    }

    return new Set(storedSyllables.map(normalizeSyllable).filter(isValidSyllableText));
  } catch {
    return new Set();
  }
}

function setActiveSyllables(syllables) {
  const activeSet = new Set(syllables.map(normalizeSyllable));
  const nextSyllables = getSyllables().map((entry) => {
    return { ...entry, active: activeSet.has(entry.text) };
  });
  setSyllables(nextSyllables);
  return getActiveSyllables();
}

function isSyllableActive(syllable) {
  const normalized = normalizeSyllable(syllable);
  return getSyllables().some((entry) => entry.text === normalized && entry.active);
}

function resetActiveSyllables() {
  return setActiveSyllables([]);
}

function sanitizeSyllableEntries(syllables) {
  const entriesByText = new Map();

  syllables.forEach((item) => {
    const entry = normalizeSyllableEntry(item);
    if (entry && !entriesByText.has(entry.text)) {
      entriesByText.set(entry.text, entry);
    }
  });

  return [...entriesByText.values()];
}

function normalizeSyllableEntry(item) {
  const text = normalizeSyllable(typeof item === "object" && item ? item.text : item);
  if (!isValidSyllableText(text)) {
    return null;
  }

  const defaultLevelIndexes = getStandardLevelIndexes(text);
  const levelIndexes = sanitizeLevelIndexes(typeof item === "object" && item ? item.levelIndexes : defaultLevelIndexes, defaultLevelIndexes);

  return {
    text,
    levelIndexes,
    active: Boolean(typeof item === "object" && item ? item.active : false),
  };
}

function normalizeSyllable(syllable) {
  return String(syllable || "").trim().toLowerCase();
}

function isValidSyllableText(syllable) {
  return Boolean(syllable) && !/\s/.test(syllable);
}

function isValidNewSyllable(syllable) {
  return isValidSyllableText(syllable) && !getSyllableTexts().includes(syllable);
}

function sanitizeLevelIndexes(levelIndexes, fallback = getDefaultLevelIndexes()) {
  const levelCount = getLevelCount();
  const validIndexes = Array.isArray(levelIndexes)
    ? levelIndexes
      .map((index) => Number(index))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < levelCount)
    : [];

  const uniqueIndexes = [...new Set(validIndexes)].sort((a, b) => a - b);
  return uniqueIndexes.length ? uniqueIndexes : fallback;
}

function getDefaultLevelIndexes() {
  return [Math.max(0, getLevelCount() - 1)];
}

function getStandardSyllableTexts() {
  return [...new Set(ALL_SYLLABLES)];
}

function getStandardLevelIndexes(syllable) {
  // Legacy targetPool is read only to initialize/migrate levelIndexes.
  // Runtime game selection uses syllable.levelIndexes instead.
  const levelIndexes = getLevels()
    .map((level, index) => (level.targetPool || []).includes(syllable) ? index : -1)
    .filter((index) => index >= 0);
  return levelIndexes.length ? levelIndexes : getDefaultLevelIndexes();
}

function addCustomSyllable(syllable, levelIndexes) {
  return addSyllable(syllable, levelIndexes);
}

function deleteCustomSyllable(syllable) {
  deleteSyllable(syllable);
}

function getCustomSyllables() {
  return getSyllableTexts();
}

function getCustomSyllableEntries() {
  return getSyllables();
}

function isCustomSyllable() {
  return false;
}

function getCustomSyllableLevelIndexes(syllable) {
  const normalized = normalizeSyllable(syllable);
  const entry = getSyllables().find((item) => item.text === normalized);
  return entry ? [...entry.levelIndexes] : [];
}

function setCustomSyllableLevelIndexes(syllable, levelIndexes) {
  return setSyllableLevelIndexes(syllable, levelIndexes);
}

function getSyllableText(value) {
  return typeof value === "object" && value ? value.text : value;
}

function getLevelCount() {
  return getLevels().length || 1;
}

function getLevels() {
  return window.SYLLABESTOON_CONFIG?.levels || [];
}

let availableRewardVideosPromise = null;
let availableRewardSoundsPromise = null;

function getAvailableRewardVideos() {
  if (!availableRewardVideosPromise) {
    availableRewardVideosPromise = fetch("assets/videos/videos.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Reward video manifest unavailable: ${response.status}`);
        }
        return response.json();
      })
      .then((videos) => normalizeRewardFiles(videos))
      .then((videos) => videos.length ? videos : getFallbackRewardVideos())
      .catch(() => getFallbackRewardVideos());
  }

  return availableRewardVideosPromise;
}

function getAvailableRewardSounds() {
  if (!availableRewardSoundsPromise) {
    availableRewardSoundsPromise = fetch("assets/audio/rewards/sounds.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Reward sound manifest unavailable: ${response.status}`);
        }
        return response.json();
      })
      .then((sounds) => normalizeRewardFiles(sounds))
      .then((sounds) => sounds.length ? sounds : getFallbackRewardSounds())
      .catch(() => getFallbackRewardSounds());
  }

  return availableRewardSoundsPromise;
}

async function getRewardVideosForLevel(levelIndex) {
  const videos = await getAvailableRewardVideos();
  const levelVideos = filterRewardFilesForLevel(videos, levelIndex)
    .filter((video) => isRewardVideoAllowedForLevel(video.file, levelIndex));
  const activeLevelVideos = filterActiveRewardFiles(levelVideos, ACTIVE_REWARD_VIDEOS_STORAGE_KEY);
  return activeLevelVideos.length ? activeLevelVideos : levelVideos;
}

async function getRewardSoundsForLevel(levelIndex) {
  const sounds = await getAvailableRewardSounds();
  const levelSounds = filterRewardFilesForLevel(sounds, levelIndex);
  return filterActiveRewardFiles(levelSounds, ACTIVE_REWARD_SOUNDS_STORAGE_KEY);
}

function normalizeRewardFiles(files) {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((file) => normalizeRewardFile(file))
    .filter(Boolean);
}

function normalizeRewardFile(rewardFile) {
  const file = typeof rewardFile === "string" ? rewardFile : rewardFile?.file;
  if (!file) {
    return null;
  }

  return {
    file,
    levels: Array.isArray(rewardFile.levels) ? rewardFile.levels : undefined,
  };
}

function filterRewardFilesForLevel(files, levelIndex) {
  const levelFiles = files.filter((file) => {
    return !Array.isArray(file.levels) || file.levels.includes(levelIndex);
  });
  return levelFiles.length ? levelFiles : files;
}

function filterActiveRewardFiles(files, storageKey) {
  const activeFiles = getActiveRewardFileSet(storageKey, files);
  return files.filter((file) => activeFiles.has(file.file));
}

function getActiveRewardFileSet(storageKey, files) {
  const availableFiles = files.map((file) => file.file).filter(Boolean);
  const storedFiles = readStoredRewardFiles(storageKey);
  if (storedFiles === null) {
    return new Set(availableFiles);
  }

  return new Set(storedFiles.filter((file) => availableFiles.includes(file)));
}

function readStoredRewardFiles(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const files = JSON.parse(raw);
    if (!Array.isArray(files)) {
      return null;
    }

    return [...new Set(files.map((file) => String(file || "").trim()).filter(Boolean))];
  } catch {
    return null;
  }
}

function setActiveRewardVideos(files) {
  return setActiveRewardFiles(ACTIVE_REWARD_VIDEOS_STORAGE_KEY, files);
}

function setActiveRewardSounds(files) {
  return setActiveRewardFiles(ACTIVE_REWARD_SOUNDS_STORAGE_KEY, files);
}

function setActiveRewardFiles(storageKey, files) {
  const sanitizedFiles = [...new Set((Array.isArray(files) ? files : [])
    .map((file) => String(file || "").trim())
    .filter(Boolean))];
  window.localStorage.setItem(storageKey, JSON.stringify(sanitizedFiles));
  return sanitizedFiles;
}

function getActiveRewardVideoFiles(files) {
  return [...getActiveRewardFileSet(ACTIVE_REWARD_VIDEOS_STORAGE_KEY, files)];
}

function getActiveRewardSoundFiles(files) {
  return [...getActiveRewardFileSet(ACTIVE_REWARD_SOUNDS_STORAGE_KEY, files)];
}

function getRewardVideoLevelIndexes(file) {
  const levelsByFile = readRewardVideoLevelMap();
  return Array.isArray(levelsByFile[file]) ? [...levelsByFile[file]] : null;
}

function setRewardVideoLevelIndexes(file, levelIndexes) {
  const normalizedFile = String(file || "").trim();
  if (!normalizedFile) {
    return null;
  }

  const levelsByFile = readRewardVideoLevelMap();
  const sanitizedIndexes = Array.isArray(levelIndexes)
    ? sanitizeLevelIndexes(levelIndexes, [])
    : [];
  if (!sanitizedIndexes.length || sanitizedIndexes.length >= getLevelCount()) {
    delete levelsByFile[normalizedFile];
  } else {
    levelsByFile[normalizedFile] = sanitizedIndexes;
  }

  window.localStorage.setItem(REWARD_VIDEO_LEVELS_STORAGE_KEY, JSON.stringify(levelsByFile));
  return getRewardVideoLevelIndexes(normalizedFile);
}

function isRewardVideoAllowedForLevel(file, levelIndex) {
  const levelIndexes = getRewardVideoLevelIndexes(file);
  return !Array.isArray(levelIndexes) || levelIndexes.includes(levelIndex);
}

function readRewardVideoLevelMap() {
  try {
    const raw = window.localStorage.getItem(REWARD_VIDEO_LEVELS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const storedLevels = JSON.parse(raw);
    if (!storedLevels || typeof storedLevels !== "object" || Array.isArray(storedLevels)) {
      return {};
    }

    return Object.fromEntries(Object.entries(storedLevels)
      .map(([file, levelIndexes]) => {
        const sanitizedIndexes = sanitizeLevelIndexes(levelIndexes, []);
        return sanitizedIndexes.length ? [file, sanitizedIndexes] : null;
      })
      .filter(Boolean));
  } catch {
    return {};
  }
}

function getFallbackRewardVideos(levelIndex = null) {
  const fallbackVideos = normalizeRewardFiles(window.SYLLABESTOON_CONFIG?.fallbackVideos || []);
  if (levelIndex === null) {
    return fallbackVideos;
  }

  return filterRewardFilesForLevel(fallbackVideos, levelIndex);
}

function getFallbackRewardSounds(levelIndex = null) {
  const fallbackSounds = normalizeRewardFiles(window.SYLLABESTOON_CONFIG?.fallbackRewardSounds || []);
  if (levelIndex === null) {
    return fallbackSounds;
  }

  return filterRewardFilesForLevel(fallbackSounds, levelIndex);
}

window.getAllSyllables = getAllSyllables;

window.SYLLABESTOON_CONFIG = {
  syllableGroups: SYLLABLE_GROUPS,

  syllables: ALL_SYLLABLES,

  getSyllables,
  setSyllables,
  getSyllablesForLevel,
  getSyllableTexts,
  addSyllable,
  deleteSyllable,
  setSyllableActive,
  setSyllableLevelIndexes,
  getAllSyllables,
  getActiveSyllables,
  getConfiguredActiveSyllables,
  setActiveSyllables,
  isSyllableActive,
  resetActiveSyllables,
  getCustomSyllables,
  getCustomSyllableEntries,
  addCustomSyllable,
  deleteCustomSyllable,
  isCustomSyllable,
  getCustomSyllableLevelIndexes,
  setCustomSyllableLevelIndexes,
  getCustomSyllablesForLevel: (levelIndex) => getSyllablesForLevel(levelIndex).map((entry) => entry.text),
  getLevelTargetPool: (levelIndex) => getSyllablesForLevel(levelIndex).map((entry) => entry.text),
  getActiveSyllablesForLevel: (levelIndex) => getSyllablesForLevel(levelIndex).map((entry) => entry.text),
  getAvailableRewardVideos,
  getRewardVideosForLevel,
  getAvailableRewardSounds,
  getRewardSoundsForLevel,
  getActiveRewardVideoFiles,
  getActiveRewardSoundFiles,
  setActiveRewardVideos,
  setActiveRewardSounds,
  getRewardVideoLevelIndexes,
  setRewardVideoLevelIndexes,
  isRewardVideoAllowedForLevel,

  starterSyllables: SYLLABLE_GROUPS.starter,

  audio: {
    syllablePath: "assets/audio/syllables",
    extensions: ["mp3", "wav", "ogg"],
    useRecordedVoiceFirst: true,
  },

  themes: [
    {
      id: "theme-candy",
      label: "Candy",
      background: "assets/images/soft-cartoon-bg.png",
      intent: "Univers doux, rond et rassurant.",
    },
    {
      id: "theme-toon",
      label: "Toon",
      background: "assets/images/toon-classic-bg.png",
      intent: "Univers cartoon classique, expressif et vivant.",
    },
    {
      id: "theme-manga",
      label: "Manga",
      background: "assets/images/manga-energy-bg.png",
      intent: "Univers tres stimulant, dynamique et contrastÃ©.",
    },
  ],

  levels: [
    // Legacy: targetPool is kept only to initialize/migrate levelIndexes
    // for the unified syllable model. It must not drive runtime gameplay.
    {
      name: "N1 - 3 cartes, 1 réponse, cible visible, aéré",
      totalCards: 3,
      targets: 1,
      targetPool: SYLLABLE_GROUPS.starter,
      rotations: [0],
      sizes: ["large"],
      fontVariants: ["readable"],
      distractorMode: "far",
      colorVariety: "low",
      density: "loose",
      showTarget: true,
      hintAfterMistakes: 1,
    },
    {
      name: "N2 - 4 cartes, 1 réponse, cible visible, aéré",
      totalCards: 4,
      targets: 1,
      targetPool: ["ma", "la", "pi", "to", "bu", "se", "mi", "lo"],
      rotations: [0],
      sizes: ["large"],
      fontVariants: ["readable"],
      distractorMode: "far",
      colorVariety: "low",
      density: "loose",
      showTarget: true,
      hintAfterMistakes: 2,
    },
    {
      name: "N3 - 6 cartes, 2 réponses, cible visible",
      totalCards: 6,
      targets: 2,
      targetPool: SYLLABLE_GROUPS.starter,
      rotations: [-4, 0, 4],
      sizes: ["large", "medium"],
      fontVariants: ["readable"],
      distractorMode: "far",
      colorVariety: "medium",
      density: "comfortable",
      showTarget: true,
      hintAfterMistakes: 2,
    },
    {
      name: "N4 - 7 cartes, 2 réponses, cible visible, mélange",
      totalCards: 7,
      targets: 2,
      targetPool: ["ma", "la", "pi", "to", "bu", "se", "mi", "lo", "pa", "tu"],
      rotations: [-8, -4, 0, 4, 8],
      sizes: ["large", "medium"],
      fontVariants: ["readable", "bouncy"],
      distractorMode: "mixed",
      colorVariety: "high",
      density: "comfortable",
      showTarget: true,
      hintAfterMistakes: 2,
    },
    {
      name: "N5 - 8 cartes, 2 réponses, même voyelle",
      totalCards: 8,
      targets: 2,
      targetPool: SYLLABLE_GROUPS.early,
      rotations: [-8, -4, 0, 5, 9],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy"],
      distractorMode: "sameVowel",
      colorVariety: "high",
      density: "comfortable",
      showTarget: true,
      hintAfterMistakes: 2,
    },
    {
      name: "N6 - 9 cartes, 2 réponses, même départ, dense",
      totalCards: 9,
      targets: 2,
      targetPool: [
        "ma", "me", "mi", "mo", "mu",
        "pa", "pe", "pi", "po", "pu",
        "la", "le", "li", "lo", "lu",
      ],
      rotations: [-10, -6, 0, 6, 10],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy", "round"],
      distractorMode: "sameConsonant",
      colorVariety: "high",
      density: "dense",
      showTarget: true,
      hintAfterMistakes: 3,
    },
    {
      name: "N7 - 10 cartes, 3 réponses, proches, dense",
      totalCards: 10,
      targets: 3,
      targetPool: SYLLABLE_GROUPS.core,
      rotations: [-12, -8, -4, 0, 5, 9, 12],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy", "round"],
      distractorMode: "near",
      colorVariety: "high",
      density: "dense",
      showTarget: true,
      hintAfterMistakes: 3,
    },
    {
      name: "N8 - 10 cartes, 2 réponses, cible cachée, mélange dense",
      totalCards: 10,
      targets: 2,
      targetPool: SYLLABLE_GROUPS.extended,
      rotations: [-12, -8, -4, 0, 5, 9, 12],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy", "round"],
      distractorMode: "mixed",
      colorVariety: "high",
      density: "dense",
      showTarget: false,
      hintAfterMistakes: 2,
    },
    {
      name: "N9 - 10 cartes, 2 réponses, sons inversés, dense",
      totalCards: 10,
      targets: 2,
      targetPool: SYLLABLE_GROUPS.inverseEarly,
      rotations: [-10, -6, 0, 6, 10],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy", "round"],
      distractorMode: "inverseFar",
      colorVariety: "high",
      density: "dense",
      showTarget: true,
      hintAfterMistakes: 2,
    },
    {
      name: "N10 - 12 cartes, 3 réponses, cible cachée, mélange dense",
      totalCards: 12,
      targets: 3,
      targetPool: [
        ...SYLLABLE_GROUPS.extended,
        ...SYLLABLE_GROUPS.inverseCore,
        ...SYLLABLE_GROUPS.vowelPairs,
        ...SYLLABLE_GROUPS.vowelTriples,
      ],
      rotations: [-14, -9, -4, 0, 5, 10, 14],
      sizes: ["large", "medium", "small"],
      fontVariants: ["readable", "bouncy", "round"],
      distractorMode: "near",
      colorVariety: "high",
      density: "dense",
      showTarget: false,
      hintAfterMistakes: 3,
    },
  ],

  encouragements: [
    "Bravo, tu l'as trouvÃ©e.",
    "Super, continue comme Ã§a.",
    "Oui, c'est bien celle-lÃ .",
    "TrÃ¨s bien, encore une.",
    "GÃ©nial, tu as bien Ã©coutÃ©.",
    "Excellent, tes yeux ont trouvÃ©.",
    "Youpi, c'est la bonne syllabe.",
    "Magnifique, continue.",
    "Tu as repÃ©rÃ© {syllable} avec attention.",
    "Ton Ã©coute t'a bien aidÃ©.",
    "Tu as pris le temps de regarder.",
    "Belle recherche, tu avances bien.",
    "Tes yeux et tes oreilles travaillent ensemble.",
    "Tu as gardÃ© ton idÃ©e jusqu'au bout.",
    "C'est une rÃ©ponse trÃ¨s prÃ©cise.",
    "Tu progresses avec calme.",
  ],

  gentleHelps: [
    "On rÃ©essaie doucement.",
    "Ã‰coute encore la syllabe.",
    "Presque. Regarde bien les lettres.",
    "Pas grave, on continue ensemble.",
    "Tu peux prendre ton temps.",
    "Je te la redis, puis on cherche.",
    "On avance tranquillement.",
    "La bonne syllabe est encore dans le nuage.",
    "Regarde une carte aprÃ¨s l'autre.",
    "Tu n'as pas perdu, tu cherches encore.",
    "On respire, puis on rÃ©Ã©coute.",
    "Essaie de retrouver les mÃªmes lettres.",
    "Ton cerveau est en train d'apprendre.",
    "Je reste avec toi, on continue.",
  ],

  completionMessages: [
    "Magnifique, toutes les syllabes sont trouvÃ©es.",
    "Bravo, le nuage est rÃ©ussi.",
    "TrÃ¨s beau travail.",
    "Formidable, tu as terminÃ©.",
    "Quelle belle rÃ©ussite.",
    "Tu as Ã©coutÃ© jusqu'au bout.",
    "Tu peux Ãªtre fier de toi.",
    "Tu as gagnÃ© une surprise.",
  ],

  rewardBadges: ["Super !", "Youpi !", "Top !", "Waouh !", "GÃ©nial !", "Encore !"],

  firstTryMessages: [
    "TrouvÃ© du premier coup.",
    "Quelle Ã©coute rapide.",
    "Tu as reconnu {syllable} tout de suite.",
    "RÃ©ponse Ã©clair et bien choisie.",
  ],

  comebackMessages: [
    "Tu as continuÃ©, et tu as trouvÃ©.",
    "Belle persÃ©vÃ©rance.",
    "Tu as essayÃ© encore, c'est exactement comme Ã§a qu'on apprend.",
    "Tu as transformÃ© l'essai en rÃ©ussite.",
  ],

  rewardShows: [
    {
      id: "videoRecomp1",
      name: "La video surprise",
      message: "Une petite video se lance pour feter ta reussite.",
      className: "show-video-reward",
      video: "assets/videos/rewards/recomp1.mp4",
      props: [],
    },
    {
      id: "videoRecomp2",
      name: "La deuxieme video surprise",
      message: "Une nouvelle video apparait pour celebrer ton effort.",
      className: "show-video-reward",
      video: "assets/videos/rewards/recomp2.mp4",
      props: [],
    },
  ],

  fallbackVideos: [
    { file: "rewards/recomp1.mp4" },
    { file: "rewards/recomp2.mp4" },
  ],

  fallbackRewardSounds: [
    { file: "reward_bubble_fun.mp3" },
    { file: "reward_gentle_chime.mp3" },
    { file: "reward_happy_steps.mp3" },
    { file: "reward_magic_pop.mp3" },
    { file: "reward_soft_success.mp3" },
    { file: "reward_star_twinkle.mp3" },
  ],
};

