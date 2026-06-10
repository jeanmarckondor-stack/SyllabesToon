(() => {
  const config = window.SYLLABESTOON_CONFIG;
  const teacherPin = "1234";
  const accessStorageKey = "syllabestoon.teacherAccess.v1";
  const minActiveSyllables = 3;
  const dbName = "syllabestoon.teacherVoice.v1";
  const storeName = "syllableAudio";
  const rewardVideoLevelsStorageKey = "syllabestoon.rewardVideoLevels.v1";
  let managerInitialized = false;
  const state = {
    tab: "add",
    manageFilter: "all",
    recordFilter: "all",
    recordIndex: 0,
    guidedRecording: false,
    openCategorySyllable: "",
    openRewardVideoLevels: "",
    syllables: [],
    activeSyllables: [],
    audioKeys: new Set(),
    rewardVideos: [],
    rewardSounds: [],
    addSyllable: "",
    recorder: null,
    chunks: [],
    recordingSyllable: "",
    recordingContext: "",
    stream: null,
  };

  const elements = {
    accessPanel: document.querySelector("#teacherPinScreen"),
    accessForm: document.querySelector("#teacherPinForm"),
    accessPin: document.querySelector("#teacherPinInput"),
    accessMessage: document.querySelector("#teacherPinMessage"),
    managerContent: document.querySelector("#teacherManagerContent"),
    pinBackToGame: document.querySelector("#teacherPinBackToGame"),
    managerBackToGame: document.querySelector("#teacherManagerBackToGame"),
    message: document.querySelector("#teacherManagerMessage"),
    dashboardTotal: document.querySelector("#dashboardTotalSyllables"),
    dashboardActive: document.querySelector("#dashboardActiveSyllables"),
    dashboardRecorded: document.querySelector("#dashboardRecordedSyllables"),
    dashboardActiveMissing: document.querySelector("#dashboardActiveMissingAudio"),
    dashboardStatus: document.querySelector("#teacherDashboardStatus"),
    dashboardActivateSyllables: document.querySelector("#dashboardActivateSyllables"),
    dashboardRecordMissingVoices: document.querySelector("#dashboardRecordMissingVoices"),
    dashboardBackToGame: document.querySelector("#dashboardBackToGame"),
    exportConfig: document.querySelector("#exportTeacherConfig"),
    importConfig: document.querySelector("#importTeacherConfig"),
    importConfigFile: document.querySelector("#importTeacherConfigFile"),
    tabs: Array.from(document.querySelectorAll("[data-tab]")),
    panels: Array.from(document.querySelectorAll("[data-panel]")),
    newSyllable: document.querySelector("#managerNewSyllable"),
    addButton: document.querySelector("#managerAddSyllable"),
    addRecordSyllable: document.querySelector("#addRecordSyllable"),
    addRecordStatus: document.querySelector("#addRecordStatus"),
    addRecordStart: document.querySelector("#addRecordStart"),
    addRecordStop: document.querySelector("#addRecordStop"),
    addRecordPlay: document.querySelector("#addRecordPlay"),
    addRecordRetry: document.querySelector("#addRecordRetry"),
    activeCount: document.querySelector("#managerActiveCount"),
    manageFilters: Array.from(document.querySelectorAll("[data-manage-filter]")),
    search: document.querySelector("#managerSearch"),
    toggleLevelHelp: document.querySelector("#toggleLevelHelp"),
    levelHelp: document.querySelector("#levelHelpPanel"),
    list: document.querySelector("#managerSyllableList"),
    recordToolbar: document.querySelector(".teacher-record-toolbar"),
    recordFilters: Array.from(document.querySelectorAll("[data-record-filter]")),
    recordPrevious: document.querySelector("#recordPrevious"),
    recordNext: document.querySelector("#recordNext"),
    recordPosition: document.querySelector("#recordPosition"),
    recordSyllable: document.querySelector("#recordSyllable"),
    recordStatus: document.querySelector("#recordStatus"),
    recordStart: document.querySelector("#recordStart"),
    recordStop: document.querySelector("#recordStop"),
    recordPlay: document.querySelector("#recordPlay"),
    recordRetry: document.querySelector("#recordRetry"),
    recordDelete: document.querySelector("#recordDelete"),
    rewardVideos: document.querySelector("#rewardVideoList"),
    rewardSounds: document.querySelector("#rewardSoundList"),
    guidedToggle: null,
    recordSkip: null,
  };

  boot();

  async function boot() {
    showPinScreen();
    bindAccessEvents();
    if (hasTeacherAccess()) {
      await showTeacherContent();
    }
  }

  function bindAccessEvents() {
    elements.accessForm.addEventListener("submit", (event) => {
      event.preventDefault();
      checkTeacherPin();
    });
    elements.pinBackToGame.addEventListener("click", returnToGame);
    elements.managerBackToGame.addEventListener("click", returnToGame);
    elements.dashboardBackToGame.addEventListener("click", returnToGame);
  }

  function hasTeacherAccess() {
    try {
      return window.sessionStorage.getItem(accessStorageKey) === "granted";
    } catch {
      return false;
    }
  }

  async function checkTeacherPin() {
    const pin = elements.accessPin.value.trim();
    if (pin !== teacherPin) {
      elements.accessMessage.textContent = "Code PIN incorrect.";
      elements.accessPin.select();
      return;
    }

    try {
      window.sessionStorage.setItem(accessStorageKey, "granted");
    } catch {
      elements.accessMessage.textContent = "Session indisponible.";
      return;
    }
    elements.accessMessage.textContent = "";
    await showTeacherContent();
  }

  async function showTeacherContent() {
    document.body.classList.remove("teacher-pin-locked");
    document.body.classList.add("teacher-pin-authorized");
    elements.accessPanel.hidden = true;
    elements.accessPanel.setAttribute("aria-hidden", "true");
    elements.accessPanel.style.display = "none";
    elements.managerContent.hidden = false;
    elements.managerContent.setAttribute("aria-hidden", "false");
    elements.managerContent.style.removeProperty("display");
    if (!managerInitialized) {
      managerInitialized = true;
      await initializeManager();
    }
  }

  function showPinScreen() {
    document.body.classList.add("teacher-pin-locked");
    document.body.classList.remove("teacher-pin-authorized");
    elements.accessPanel.hidden = false;
    elements.accessPanel.setAttribute("aria-hidden", "false");
    elements.accessPanel.style.removeProperty("display");
    elements.managerContent.hidden = true;
    elements.managerContent.setAttribute("aria-hidden", "true");
    elements.managerContent.style.display = "none";
    elements.accessPin.focus();
  }

  function clearTeacherAuthorization() {
    try {
      window.sessionStorage.removeItem(accessStorageKey);
    } catch {
      // Nothing to clear when sessionStorage is unavailable.
    }
  }

  function returnToGame(event) {
    event.preventDefault();
    clearTeacherAuthorization();
    window.location.href = "index.html";
  }

  async function initializeManager() {
    bindEvents();
    await refreshState();
    renderAll();
  }

  function bindEvents() {
    setupRecordGuidedControls();

    elements.dashboardActivateSyllables.addEventListener("click", openInactiveSyllables);
    elements.dashboardRecordMissingVoices.addEventListener("click", openMissingVoices);
    elements.exportConfig.addEventListener("click", exportTeacherConfig);
    elements.importConfig.addEventListener("click", () => elements.importConfigFile.click());
    elements.importConfigFile.addEventListener("change", importTeacherConfig);

    elements.tabs.forEach((button) => {
      button.addEventListener("click", () => selectTab(button.dataset.tab));
    });

    elements.addButton.addEventListener("click", addSyllableAndRecord);
    elements.newSyllable.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        addSyllableAndRecord();
      }
    });

    elements.manageFilters.forEach((button) => {
      button.addEventListener("click", () => {
        state.manageFilter = button.dataset.manageFilter;
        updateActiveButton(elements.manageFilters, button);
        renderManage();
      });
    });
    elements.search.addEventListener("input", renderManage);
    elements.toggleLevelHelp.addEventListener("click", toggleLevelHelp);

    elements.recordFilters.forEach((button) => {
      button.addEventListener("click", () => {
        state.recordFilter = button.dataset.recordFilter;
        state.recordIndex = 0;
        updateActiveButton(elements.recordFilters, button);
        renderRecord();
      });
    });
    elements.recordPrevious.addEventListener("click", () => moveRecord(-1));
    elements.recordNext.addEventListener("click", () => moveRecord(1));

    bindRecordButtons("add", {
      start: elements.addRecordStart,
      stop: elements.addRecordStop,
      play: elements.addRecordPlay,
      retry: elements.addRecordRetry,
    });
    bindRecordButtons("focus", {
      start: elements.recordStart,
      stop: elements.recordStop,
      play: elements.recordPlay,
      retry: elements.recordRetry,
      remove: elements.recordDelete,
    });
  }

  function setupRecordGuidedControls() {
    const controls = document.createElement("div");
    controls.className = "teacher-guided-controls";

    const toggle = document.createElement("button");
    toggle.id = "recordGuidedToggle";
    toggle.className = "audio-test-button teacher-guided-toggle";
    toggle.type = "button";
    toggle.textContent = "Enregistrement guidÃ©";
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      state.guidedRecording = !state.guidedRecording;
      updateGuidedControls();
    });

    const skip = document.createElement("button");
    skip.id = "recordSkip";
    skip.className = "audio-test-button teacher-skip-button";
    skip.type = "button";
    skip.textContent = "Passer";
    skip.addEventListener("click", () => moveRecord(1));

    controls.append(toggle, skip);
    elements.recordToolbar.appendChild(controls);
    elements.guidedToggle = toggle;
    elements.recordSkip = skip;
    updateGuidedControls();
  }

  function bindRecordButtons(context, buttons) {
    buttons.start.addEventListener("click", () => startRecording(getContextSyllable(context), context));
    buttons.stop.addEventListener("click", stopRecording);
    buttons.play.addEventListener("click", () => playAudio(getContextSyllable(context)));
    buttons.retry.addEventListener("click", () => startRecording(getContextSyllable(context), context));
    buttons.remove?.addEventListener("click", () => deleteAudio(getContextSyllable(context)));
  }

  async function refreshState() {
    state.syllables = config.getSyllables();
    state.activeSyllables = config.getActiveSyllables();
    state.audioKeys = new Set(await listRecordedTeacherSyllables().catch(() => []));
    state.rewardVideos = await loadRewardFiles("video");
    state.rewardSounds = await loadRewardFiles("sound");
  }

  function renderAll() {
    renderDashboard();
    renderAdd();
    renderLevelHelp();
    renderManage();
    renderRecord();
    renderRewards();
  }

  function renderDashboard() {
    const syllableTexts = state.syllables.map((entry) => entry.text);
    const activeTexts = state.syllables.filter((entry) => entry.active).map((entry) => entry.text);
    const recordedCount = syllableTexts.filter((syllable) => state.audioKeys.has(syllable)).length;
    const activeMissingCount = activeTexts.filter((syllable) => !state.audioKeys.has(syllable)).length;

    elements.dashboardTotal.textContent = String(syllableTexts.length);
    elements.dashboardActive.textContent = String(activeTexts.length);
    elements.dashboardRecorded.textContent = String(recordedCount);
    elements.dashboardActiveMissing.textContent = String(activeMissingCount);

    if (!activeTexts.length) {
      elements.dashboardStatus.textContent = "Aucune syllabe active";
      elements.dashboardStatus.dataset.state = "empty";
    } else if (activeMissingCount > 0) {
      elements.dashboardStatus.textContent = `${activeMissingCount} syllabes actives sans voix`;
      elements.dashboardStatus.dataset.state = "warning";
    } else {
      elements.dashboardStatus.textContent = "S\u00e9ance pr\u00eate";
      elements.dashboardStatus.dataset.state = "ready";
    }
  }

  function selectTab(tab) {
    state.tab = tab;
    elements.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
    renderRecord();
  }

  function openInactiveSyllables() {
    const inactiveFilter = elements.manageFilters.find((button) => button.dataset.manageFilter === "inactive");
    state.manageFilter = "inactive";
    updateActiveButton(elements.manageFilters, inactiveFilter);
    selectTab("manage");
    renderManage();
  }

  function openMissingVoices() {
    const missingFilter = elements.recordFilters.find((button) => button.dataset.recordFilter === "missing");
    state.recordFilter = "missing";
    state.recordIndex = 0;
    state.guidedRecording = true;
    updateActiveButton(elements.recordFilters, missingFilter);
    selectTab("record");
    renderRecord();
  }

  function exportTeacherConfig() {
    const payload = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      syllables: config.getSyllables(),
      activeRewardVideos: [...getActiveRewardFiles("video")],
      rewardVideoLevels: readRewardVideoLevelMap(),
      activeRewardSounds: [...getActiveRewardFiles("sound")],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "syllabestoon-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage("Export réussi.");
  }

  async function importTeacherConfig() {
    const file = elements.importConfigFile.files?.[0];
    elements.importConfigFile.value = "";
    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      const nextConfig = validateTeacherConfigPayload(payload);
      applyTeacherConfig(nextConfig);
      state.openCategorySyllable = "";
      state.openRewardVideoLevels = "";
      await refreshState();
      renderAll();
      showMessage("Import réussi.");
    } catch {
      showMessage("Fichier invalide.");
    }
  }

  function validateTeacherConfigPayload(payload) {
    if (!payload || typeof payload !== "object" || payload.exportVersion !== 1) {
      throw new Error("Invalid export version.");
    }
    if (!Array.isArray(payload.syllables)) {
      throw new Error("Invalid syllables.");
    }

    return {
      syllables: payload.syllables,
      activeRewardVideos: validateStringArray(payload.activeRewardVideos),
      rewardVideoLevels: validateRewardVideoLevels(payload.rewardVideoLevels),
      activeRewardSounds: validateStringArray(payload.activeRewardSounds),
    };
  }

  function validateStringArray(value) {
    if (!Array.isArray(value)) {
      throw new Error("Invalid file list.");
    }

    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function validateRewardVideoLevels(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid video levels.");
    }

    return Object.fromEntries(Object.entries(value)
      .map(([file, levelIndexes]) => {
        const sanitizedIndexes = sanitizeLevelIndexes(levelIndexes);
        return file && sanitizedIndexes.length ? [file, sanitizedIndexes] : null;
      })
      .filter(Boolean));
  }

  function applyTeacherConfig(nextConfig) {
    config.setSyllables(nextConfig.syllables);
    config.setActiveRewardVideos(nextConfig.activeRewardVideos);
    config.setActiveRewardSounds(nextConfig.activeRewardSounds);
    window.localStorage.setItem(rewardVideoLevelsStorageKey, JSON.stringify(nextConfig.rewardVideoLevels));
  }

  function renderAdd() {
    const syllable = state.addSyllable || "?";
    elements.addRecordSyllable.textContent = syllable;
    updateRecordStatus("add", state.addSyllable);
  }

  function renderManage() {
    const syllables = getFilteredManageSyllables();
    elements.activeCount.textContent = `${state.activeSyllables.length} actives / ${state.syllables.length} total`;
    elements.list.innerHTML = "";
    syllables.forEach((entry) => {
      elements.list.appendChild(createManageRow(entry));
    });
  }

  function renderRewards() {
    renderRewardList({
      container: elements.rewardVideos,
      files: state.rewardVideos,
      activeFiles: getActiveRewardFiles("video"),
      kind: "video",
      emptyText: "Aucune vidéo trouvée.",
    });
    renderRewardList({
      container: elements.rewardSounds,
      files: state.rewardSounds,
      activeFiles: getActiveRewardFiles("sound"),
      kind: "sound",
      emptyText: "Aucun son trouvé.",
    });
  }

  function renderRewardList({ container, files, activeFiles, kind, emptyText }) {
    container.innerHTML = "";
    if (!files.length) {
      const empty = document.createElement("p");
      empty.className = "teacher-reward-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    files.forEach((file) => {
      container.appendChild(createRewardRow(file, activeFiles.has(file.file), kind));
    });
  }

  function createRewardRow(file, isActive, kind) {
    const row = document.createElement("article");
    row.className = "teacher-reward-row";
    row.dataset.state = isActive ? "active" : "inactive";

    const toggle = document.createElement("label");
    toggle.className = "teacher-reward-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isActive;
    checkbox.addEventListener("change", () => toggleRewardFile(kind, file.file, checkbox.checked));
    const status = document.createElement("span");
    status.className = `teacher-manager-badge ${isActive ? "active" : "inactive"}`;
    const dot = document.createElement("span");
    dot.className = "teacher-manager-state-dot";
    dot.setAttribute("aria-hidden", "true");
    status.append(dot, document.createTextNode(isActive ? "Activé" : "Désactivé"));
    toggle.append(checkbox, status);

    const name = document.createElement("strong");
    name.className = "teacher-reward-file";
    name.textContent = file.file;

    const levels = document.createElement("span");
    levels.className = "teacher-reward-levels";
    levels.textContent = getRewardLevelSummary(file);

    if (kind === "video") {
      const levelCell = createRewardVideoLevelControls(file, isActive);
      row.append(toggle, name, levelCell);
    } else {
      row.append(toggle, name, levels);
    }
    return row;
  }

  function createRewardVideoLevelControls(file, isActive) {
    const wrapper = document.createElement("div");
    wrapper.className = "teacher-reward-level-cell";

    const summary = document.createElement("span");
    summary.className = "teacher-reward-levels";
    summary.textContent = getRewardLevelSummary(file);

    const button = document.createElement("button");
    button.className = "audio-test-button teacher-category-button";
    button.type = "button";
    button.textContent = "Niveaux";
    button.setAttribute("aria-expanded", String(state.openRewardVideoLevels === file.file));
    button.addEventListener("click", () => toggleRewardVideoLevelPanel(file.file));

    wrapper.append(summary, button);

    if (state.openRewardVideoLevels === file.file) {
      wrapper.appendChild(createRewardVideoLevelPanel(file, isActive));
    }

    return wrapper;
  }

  function createRewardVideoLevelPanel(file, isActive) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "teacher-level-picker manager-level-picker teacher-reward-level-picker";
    const legend = document.createElement("legend");
    legend.textContent = "Niveaux de la vidéo";
    const options = document.createElement("div");
    options.className = "teacher-level-options";
    const selected = new Set(getRewardVideoLevelIndexes(file.file));

    getLevels().forEach((level, index) => {
      const label = document.createElement("label");
      label.className = "teacher-level-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = `reward-levels-${file.file}`;
      input.value = String(index);
      input.checked = selected.has(index);
      input.addEventListener("change", () => updateRewardVideoLevels(file.file, isActive));
      const text = document.createElement("span");
      text.textContent = level.name;
      label.append(input, text);
      options.appendChild(label);
    });

    fieldset.append(legend, options);
    if (Array.isArray(file.levels) && file.levels.length) {
      const manifestNote = document.createElement("p");
      manifestNote.className = "teacher-reward-manifest-note";
      manifestNote.textContent = `Limite du manifeste : niveaux ${file.levels.map((levelIndex) => levelIndex + 1).join(", ")}`;
      fieldset.appendChild(manifestNote);
    }
    return fieldset;
  }

  function createManageRow(entry) {
    const syllable = entry.text;
    const isActive = entry.active;
    const row = document.createElement("article");
    row.className = "teacher-manager-row";
    row.dataset.state = isActive ? "active" : "inactive";

    const label = document.createElement("strong");
    label.className = "audio-syllable";
    label.textContent = syllable;

    const badges = document.createElement("div");
    badges.className = "teacher-manager-badges";
    badges.append(createBadge(isActive ? "Active" : "Inactive", isActive ? "active" : "inactive"));
    const toggle = document.createElement("button");
    toggle.className = "audio-test-button";
    toggle.type = "button";
    toggle.textContent = isActive ? "Désactiver" : "Activer";
    toggle.addEventListener("click", () => toggleSyllable(syllable));

    const categories = createCategoryControls(entry);

    const record = document.createElement("button");
    record.className = "audio-test-button";
    record.type = "button";
    record.textContent = "Enregistrer voix";
    record.addEventListener("click", () => {
      state.recordFilter = "all";
      updateActiveButton(elements.recordFilters, elements.recordFilters[0]);
      state.recordIndex = Math.max(0, getRecordSyllables().indexOf(syllable));
      selectTab("record");
      startRecording(syllable, "focus");
    });

    const remove = document.createElement("button");
    remove.className = "audio-test-button teacher-delete-button";
    remove.type = "button";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", () => deleteSyllable(entry));

    row.append(label, badges, toggle, categories, record, remove);
    return row;
  }

  function createBadge(text, stateName) {
    const badge = document.createElement("span");
    badge.className = `teacher-manager-badge ${stateName}`;
    const dot = document.createElement("span");
    dot.className = "teacher-manager-state-dot";
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(text));
    return badge;
  }

  function createCategoryControls(entry) {
    const syllable = entry.text;
    const wrapper = document.createElement("div");
    wrapper.className = "teacher-category-cell";

    const summary = document.createElement("span");
    summary.className = "teacher-fixed-levels";
    summary.textContent = getLevelSummary(entry);

    const button = document.createElement("button");
    button.className = "audio-test-button teacher-category-button";
    button.type = "button";
    button.textContent = "Catégories";
    button.setAttribute("aria-expanded", String(state.openCategorySyllable === syllable));
    button.addEventListener("click", () => toggleCategoryPanel(syllable));

    wrapper.append(summary, button);

    if (state.openCategorySyllable === syllable) {
      wrapper.appendChild(createLevelPanel(syllable));
    }

    return wrapper;
  }

  function createLevelPanel(syllable) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "teacher-level-picker manager-level-picker";
    const legend = document.createElement("legend");
    legend.textContent = "Niveaux";
    const options = document.createElement("div");
    options.className = "teacher-level-options";
    const selected = new Set(getSyllableLevelIndexes(syllable));

    getLevels().forEach((level, index) => {
      options.appendChild(createLevelCheckbox(syllable, level, index, selected.has(index)));
    });
    fieldset.append(legend, options);
    return fieldset;
  }

  function createLevelCheckbox(syllable, level, index, checked, disabled = false) {
    const label = document.createElement("label");
    label.className = "teacher-level-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = `levels-${syllable}`;
    input.value = String(index);
    input.checked = checked;
    input.disabled = disabled;
    input.addEventListener("change", () => {
      console.log("level change", syllable, index, input.checked);
      updateSyllableLevels(syllable, input);
    });
    const text = document.createElement("span");
    text.textContent = level.name;
    label.append(input, text);
    return label;
  }

  function renderLevelHelp() {
    elements.levelHelp.innerHTML = "";
    getLevels().forEach((level, index) => {
      const item = document.createElement("article");
      item.className = "teacher-level-help-item";

      const title = document.createElement("strong");
      title.textContent = level.name;

      const details = document.createElement("span");
      details.textContent = [
        `${level.totalCards} cartes`,
        `${level.targets} réponse${level.targets > 1 ? "s" : ""}`,
        `cible ${level.showTarget ? "visible" : "cachée"}`,
        `densité ${level.density || "standard"}`,
        `distracteurs ${level.distractorMode || "standard"}`,
      ].join(" · ");

      item.append(title, details);
      elements.levelHelp.appendChild(item);
    });
  }

  function toggleLevelHelp() {
    const isHidden = elements.levelHelp.classList.toggle("hidden");
    elements.toggleLevelHelp.setAttribute("aria-expanded", String(!isHidden));
    elements.toggleLevelHelp.textContent = isHidden ? "Voir les niveaux" : "Masquer les niveaux";
  }

  function toggleCategoryPanel(syllable) {
    state.openCategorySyllable = state.openCategorySyllable === syllable ? "" : syllable;
    renderManage();
  }

  function getLevelSummary(entry) {
    const indexes = entry.levelIndexes;
    return indexes.length ? `Niveaux : ${indexes.map((index) => index + 1).join(", ")}` : "Niveaux : aucun";
  }

  function getSyllableLevelIndexes(syllable) {
    return getSyllableEntry(syllable)?.levelIndexes || [];
  }

  async function renderRecord() {
    const syllables = getRecordSyllables();
    if (state.recordIndex >= syllables.length) {
      state.recordIndex = Math.max(0, syllables.length - 1);
    }

    const syllable = syllables[state.recordIndex] || "";
    elements.recordSyllable.textContent = syllable || "?";
    elements.recordPosition.textContent = syllables.length ? `${state.recordIndex + 1} / ${syllables.length}` : "0 / 0";
    updateRecordStatus("focus", syllable);
    elements.recordPrevious.disabled = state.recordIndex <= 0;
    elements.recordNext.disabled = state.recordIndex >= syllables.length - 1;
    updateGuidedControls();
  }

  function getFilteredManageSyllables() {
    const query = elements.search.value.trim().toLowerCase();
    return state.syllables.filter((entry) => {
      const matchesFilter =
        state.manageFilter === "all" ||
        (state.manageFilter === "active" && entry.active) ||
        (state.manageFilter === "inactive" && !entry.active);
      return matchesFilter && (!query || entry.text.includes(query));
    }).sort(compareSyllableEntries);
  }

  function compareSyllableEntries(first, second) {
    if (first.active !== second.active) {
      return first.active ? -1 : 1;
    }

    return first.text.localeCompare(second.text, "fr", { sensitivity: "base" });
  }

  function getRecordSyllables() {
    if (state.recordFilter === "active") {
      return state.activeSyllables;
    }
    if (state.recordFilter === "missing") {
      return getAllSyllables().filter((syllable) => !state.audioKeys.has(syllable));
    }
    return getAllSyllables();
  }

  function getContextSyllable(context) {
    return context === "add" ? state.addSyllable : getRecordSyllables()[state.recordIndex];
  }

  function addSyllableAndRecord() {
    const syllable = normalizeSyllable(elements.newSyllable.value);
    if (!syllable) {
      showMessage("Entre une syllabe.");
      return;
    }
    if (/\s/.test(syllable)) {
      showMessage("Pas d'espace dans une syllabe.");
      return;
    }
    if (getAllSyllables().includes(syllable)) {
      showMessage("Déjà existant.");
      return;
    }

    const added = config.addSyllable(syllable);
    if (!added) {
      showMessage("Ajout impossible.");
      return;
    }

    elements.newSyllable.value = "";
    state.addSyllable = added;
    state.syllables = config.getSyllables();
    state.activeSyllables = config.getActiveSyllables();
    renderAll();
    showMessage("Ajouté. Tu peux enregistrer.");
    startRecording(added, "add");
  }

  async function toggleSyllable(syllable) {
    const isActive = state.activeSyllables.includes(syllable);
    if (isActive) {
      if (state.activeSyllables.length <= minActiveSyllables) {
        showMessage("Au moins 3 syllabes doivent rester actives.");
        return;
      }
    }

    config.setSyllableActive(syllable, !isActive);
    await refreshState();
    renderAll();
    showMessage("Mis à jour.");
  }

  async function deleteSyllable(entry) {
    if (state.syllables.length <= minActiveSyllables) {
      showMessage("Au moins 3 syllabes doivent rester dans la liste.");
      return;
    }

    const hasAudio = state.audioKeys.has(entry.text);
    const audioMessage = hasAudio
      ? "\n\nUne voix enregistrÃ©e existe pour cette syllabe. Elle sera conservÃ©e pour l'instant."
      : "";
    const confirmed = window.confirm(`Supprimer la syllabe "${entry.text}" ?${audioMessage}`);
    if (!confirmed) {
      return;
    }

    config.deleteSyllable(entry.text);
    if (state.openCategorySyllable === entry.text) {
      state.openCategorySyllable = "";
    }
    await refreshState();
    renderAll();
    showMessage(`${entry.text} supprimÃ©e.`);
  }

  function updateSyllableLevels(syllable, changedInput) {
    const panel = changedInput.closest(".teacher-level-options");
    const levelIndexes = Array.from(panel.querySelectorAll("input:checked")).map((input) => Number(input.value));
    if (!levelIndexes.length) {
      changedInput.checked = true;
      showMessage("Choisis au moins un niveau.");
      return;
    }

    config.setSyllableLevelIndexes(syllable, levelIndexes);
    state.syllables = config.getSyllables();
    renderManage();
    showMessage("Niveaux mis à jour.");
  }

  function moveRecord(direction) {
    state.recordIndex += direction;
    renderRecord();
  }

  function updateGuidedControls() {
    if (!elements.guidedToggle || !elements.recordSkip) {
      return;
    }

    const syllables = getRecordSyllables();
    const isLast = state.recordIndex >= syllables.length - 1;
    elements.guidedToggle.classList.toggle("active", state.guidedRecording);
    elements.guidedToggle.setAttribute("aria-pressed", String(state.guidedRecording));
    elements.recordSkip.disabled = !syllables.length || isLast;
  }

  async function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.addEventListener("upgradeneeded", () => request.result.createObjectStore(storeName));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  }

  async function useStore(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = action(store);
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
      transaction.addEventListener("complete", () => db.close());
      transaction.addEventListener("abort", () => {
        db.close();
        reject(transaction.error);
      });
    });
  }

  function saveTeacherSyllableAudio(syllable, blob) {
    return useStore("readwrite", (store) => store.put(blob, syllable));
  }

  function getTeacherSyllableAudio(syllable) {
    return useStore("readonly", (store) => store.get(syllable));
  }

  function deleteTeacherSyllableAudio(syllable) {
    return useStore("readwrite", (store) => store.delete(syllable));
  }

  function listRecordedTeacherSyllables() {
    return useStore("readonly", (store) => store.getAllKeys());
  }

  async function startRecording(syllable, context) {
    console.info("[teacher-manager] record clicked", { syllable, context });
    if (!syllable) {
      showMessage("Choisis une syllabe.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordStatus(context, "Micro non disponible", "error");
      return;
    }
    if (state.recorder?.state === "recording") {
      stopRecording();
    }

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.info("[teacher-manager] getUserMedia ok", { syllable, context });
      state.chunks = [];
      state.recordingSyllable = syllable;
      state.recordingContext = context;
      state.recorder = new MediaRecorder(state.stream);
      state.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          state.chunks.push(event.data);
        }
      });
      state.recorder.addEventListener("stop", saveCurrentRecording, { once: true });
      state.recorder.start();
      console.info("[teacher-manager] MediaRecorder started", { syllable, context, mimeType: state.recorder.mimeType });
      setRecordStatus(context, "Enregistrement en cours", "recording");
      setRecordButtons(context, { record: true, stop: false, play: true, retry: true, remove: true });
    } catch (error) {
      console.error("[teacher-manager] getUserMedia failed", error);
      setRecordStatus(context, "Micro refusé", "error");
    }
  }

  function stopRecording() {
    if (state.recorder?.state === "recording") {
      console.info("[teacher-manager] MediaRecorder stopped", {
        syllable: state.recordingSyllable,
        context: state.recordingContext,
      });
      state.recorder.stop();
    }
  }

  async function saveCurrentRecording() {
    const blob = new Blob(state.chunks, { type: state.recorder?.mimeType || "audio/webm" });
    const syllable = state.recordingSyllable;
    const context = state.recordingContext;
    const shouldAdvanceAfterSave = context === "focus" && state.guidedRecording;
    const previousRecordSyllables = shouldAdvanceAfterSave ? getRecordSyllables() : [];
    const previousRecordIndex = state.recordIndex;
    stopStream();
    state.recorder = null;
    state.chunks = [];
    state.recordingSyllable = "";
    state.recordingContext = "";

    console.info("[teacher-manager] blob size", { syllable, context, size: blob.size });

    if (!syllable || blob.size <= 0) {
      setRecordStatus(context, "Aucun son enregistré", "error");
      return;
    }

    try {
      const prepared = await trimAudioSilence(blob).catch(() => ({ blob }));
      await saveTeacherSyllableAudio(syllable, prepared.blob);
      console.info("[teacher-manager] saved ok", { syllable, context, size: prepared.blob.size });
      state.audioKeys.add(syllable);
      await refreshState();
      state.audioKeys.add(syllable);
      renderAll();
      setRecordStatus(context, "Enregistré", "recorded");
      setRecordButtons(context, { record: false, stop: true, play: false, retry: false, remove: false });
      if (shouldAdvanceAfterSave) {
        advanceGuidedRecording(syllable, previousRecordSyllables, previousRecordIndex);
        showMessage("Enregistré. Syllabe suivante.");
      } else {
        showMessage("Enregistré.");
      }
    } catch {
      setRecordStatus(context, "Sauvegarde impossible", "error");
    }
  }

  function advanceGuidedRecording(savedSyllable, previousSyllables, previousIndex) {
    const currentSyllables = getRecordSyllables();
    if (!currentSyllables.length) {
      state.recordIndex = 0;
      renderRecord();
      return;
    }

    const previousNext = previousSyllables[previousIndex + 1];
    const previousNextIndex = currentSyllables.indexOf(previousNext);
    if (previousNextIndex >= 0) {
      state.recordIndex = previousNextIndex;
      renderRecord();
      return;
    }

    const savedIndex = currentSyllables.indexOf(savedSyllable);
    if (savedIndex >= 0 && savedIndex < currentSyllables.length - 1) {
      state.recordIndex = savedIndex + 1;
      renderRecord();
      return;
    }

    state.recordIndex = Math.min(previousIndex, currentSyllables.length - 1);
    renderRecord();
  }

  async function playAudio(syllable) {
    if (!syllable) {
      return;
    }
    const blob = await getTeacherSyllableAudio(syllable).catch(() => null);
    if (!blob) {
      showMessage("Aucun audio.");
      return;
    }
    const source = URL.createObjectURL(blob);
    const audio = new Audio(source);
    audio.addEventListener("ended", () => URL.revokeObjectURL(source), { once: true });
    audio.play().catch(() => {
      URL.revokeObjectURL(source);
      showMessage("Lecture impossible.");
    });
  }

  async function deleteAudio(syllable) {
    if (!syllable) {
      return;
    }
    await deleteTeacherSyllableAudio(syllable);
    state.audioKeys.delete(syllable);
    await refreshState();
    state.audioKeys.delete(syllable);
    renderAll();
    showMessage("Supprimé.");
  }

  async function trimAudioSilence(audioBlob) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioContextClass || !OfflineAudioContextClass) {
      return { blob: audioBlob };
    }

    const context = new AudioContextClass();
    try {
      const audioBuffer = await context.decodeAudioData(await audioBlob.arrayBuffer());
      const bounds = detectAudibleBounds(audioBuffer);
      if (!bounds) {
        return { blob: audioBlob };
      }

      const sampleRate = audioBuffer.sampleRate;
      const startFrame = Math.max(0, bounds.startFrame - Math.round(sampleRate * 0.1));
      const endFrame = Math.min(audioBuffer.length, bounds.endFrame + Math.round(sampleRate * 0.15));
      if (endFrame - startFrame >= audioBuffer.length * 0.98) {
        return { blob: audioBlob };
      }

      const duration = (endFrame - startFrame) / sampleRate;
      const offline = new OfflineAudioContextClass(audioBuffer.numberOfChannels, endFrame - startFrame, sampleRate);
      const source = offline.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offline.destination);
      source.start(0, startFrame / sampleRate, duration);
      return { blob: encodeAudioBufferToWav(await offline.startRendering()) };
    } finally {
      context.close();
    }
  }

  function detectAudibleBounds(audioBuffer) {
    const windowSize = Math.max(1, Math.round(audioBuffer.sampleRate * 0.01));
    const threshold = getAdaptiveThreshold(audioBuffer, windowSize);
    let startFrame = -1;
    let endFrame = -1;

    for (let frame = 0; frame < audioBuffer.length; frame += windowSize) {
      if (getWindowRms(audioBuffer, frame, windowSize) >= threshold) {
        startFrame = frame;
        break;
      }
    }
    for (let frame = audioBuffer.length - windowSize; frame >= 0; frame -= windowSize) {
      if (getWindowRms(audioBuffer, frame, windowSize) >= threshold) {
        endFrame = Math.min(audioBuffer.length, frame + windowSize);
        break;
      }
    }
    return startFrame >= 0 && endFrame > startFrame ? { startFrame, endFrame } : null;
  }

  function getAdaptiveThreshold(audioBuffer, windowSize) {
    const values = [];
    for (let frame = 0; frame < audioBuffer.length; frame += windowSize) {
      values.push(getWindowRms(audioBuffer, frame, windowSize));
    }
    values.sort((a, b) => a - b);
    return Math.max(0.012, (values[Math.floor(values.length * 0.2)] || 0) * 4);
  }

  function getWindowRms(audioBuffer, startFrame, windowSize) {
    const endFrame = Math.min(audioBuffer.length, startFrame + windowSize);
    let sum = 0;
    let count = 0;
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let frame = Math.max(0, startFrame); frame < endFrame; frame += 1) {
        sum += data[frame] * data[frame];
        count += 1;
      }
    }
    return count ? Math.sqrt(sum / count) : 0;
  }

  function encodeAudioBufferToWav(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const dataSize = audioBuffer.length * channels * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    let offset = 0;
    offset = writeText(view, offset, "RIFF");
    view.setUint32(offset, 36 + dataSize, true); offset += 4;
    offset = writeText(view, offset, "WAVE");
    offset = writeText(view, offset, "fmt ");
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, channels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * channels * 2, true); offset += 4;
    view.setUint16(offset, channels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    offset = writeText(view, offset, "data");
    view.setUint32(offset, dataSize, true); offset += 4;

    const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
    for (let frame = 0; frame < audioBuffer.length; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function writeText(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
    return offset + text.length;
  }

  function updateRecordStatus(context, syllable) {
    if (!syllable) {
      setRecordStatus(context, "Voix synthétique", "synthetic");
      setRecordButtons(context, { record: true, stop: true, play: true, retry: true, remove: true });
      return;
    }
    const hasAudio = state.audioKeys.has(syllable);
    setRecordStatus(context, hasAudio ? "Voix enseignante disponible" : "Voix synthétique", hasAudio ? "recorded" : "synthetic");
    setRecordButtons(context, { record: false, stop: true, play: !hasAudio, retry: !hasAudio, remove: !hasAudio });
  }

  function setRecordStatus(context, text, status) {
    const target = context === "add" ? elements.addRecordStatus : elements.recordStatus;
    target.textContent = text;
    target.dataset.state = status;
  }

  function setRecordButtons(context, states) {
    const buttons = context === "add"
      ? { record: elements.addRecordStart, stop: elements.addRecordStop, play: elements.addRecordPlay, retry: elements.addRecordRetry }
      : { record: elements.recordStart, stop: elements.recordStop, play: elements.recordPlay, retry: elements.recordRetry, remove: elements.recordDelete };
    buttons.record.disabled = states.record;
    buttons.stop.disabled = states.stop;
    buttons.play.disabled = states.play;
    buttons.retry.disabled = states.retry;
    if (buttons.remove) {
      buttons.remove.disabled = states.remove;
    }
  }

  function stopStream() {
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  function updateActiveButton(buttons, activeButton) {
    buttons.forEach((button) => button.classList.toggle("active", button === activeButton));
  }

  function getConfiguredActiveSyllables() {
    if (typeof config.getConfiguredActiveSyllables === "function") {
      return config.getConfiguredActiveSyllables();
    }
    return config.getActiveSyllables();
  }

  function getAllSyllables() {
    return config.getSyllableTexts();
  }

  async function loadRewardFiles(kind) {
    const loader = kind === "video" ? config.getAvailableRewardVideos : config.getAvailableRewardSounds;
    if (typeof loader !== "function") {
      return [];
    }

    return loader.call(config).catch(() => []);
  }

  function getActiveRewardFiles(kind) {
    const files = kind === "video" ? state.rewardVideos : state.rewardSounds;
    const getter = kind === "video" ? config.getActiveRewardVideoFiles : config.getActiveRewardSoundFiles;
    if (typeof getter !== "function") {
      return new Set(files.map((file) => file.file));
    }

    return new Set(getter(files));
  }

  function toggleRewardFile(kind, file, active) {
    const files = kind === "video" ? state.rewardVideos : state.rewardSounds;
    const setter = kind === "video" ? config.setActiveRewardVideos : config.setActiveRewardSounds;
    const activeFiles = getActiveRewardFiles(kind);
    if (active) {
      activeFiles.add(file);
    } else {
      activeFiles.delete(file);
    }

    if (typeof setter === "function") {
      setter([...activeFiles]);
    }

    if (kind === "video") {
      state.rewardVideos = files;
    } else {
      state.rewardSounds = files;
    }
    renderRewards();
    showMessage("Récompenses mises à jour.");
  }

  function toggleRewardVideoLevelPanel(file) {
    state.openRewardVideoLevels = state.openRewardVideoLevels === file ? "" : file;
    renderRewards();
  }

  function updateRewardVideoLevels(file, isActive) {
    const panel = elements.rewardVideos.querySelector(`input[name="reward-levels-${CSS.escape(file)}"]`)?.closest(".teacher-level-options");
    const levelIndexes = panel
      ? Array.from(panel.querySelectorAll("input:checked")).map((input) => Number(input.value))
      : [];

    if (!levelIndexes.length) {
      config.setRewardVideoLevelIndexes(file, null);
      showMessage(isActive ? "Tous les niveaux réactivés pour cette vidéo." : "Tous les niveaux réactivés.");
      renderRewards();
      return;
    }

    config.setRewardVideoLevelIndexes(file, levelIndexes);
    renderRewards();
    showMessage("Niveaux de vidéo mis à jour.");
  }

  function getRewardVideoLevelIndexes(file) {
    if (typeof config.getRewardVideoLevelIndexes !== "function") {
      return getLevels().map((_, index) => index);
    }

    const levelIndexes = config.getRewardVideoLevelIndexes(file);
    return Array.isArray(levelIndexes) ? levelIndexes : getLevels().map((_, index) => index);
  }

  function readRewardVideoLevelMap() {
    try {
      const raw = window.localStorage.getItem(rewardVideoLevelsStorageKey);
      if (!raw) {
        return {};
      }

      return validateRewardVideoLevels(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  function sanitizeLevelIndexes(levelIndexes) {
    const levelCount = getLevels().length;
    const indexes = Array.isArray(levelIndexes) ? levelIndexes : [];
    return [...new Set(indexes
      .map((index) => Number(index))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < levelCount))]
      .sort((a, b) => a - b);
  }

  function getRewardLevelSummary(file) {
    const levelIndexes = typeof config.getRewardVideoLevelIndexes === "function"
      ? config.getRewardVideoLevelIndexes(file.file)
      : null;
    if (Array.isArray(levelIndexes) && levelIndexes.length) {
      return `Niveaux : ${levelIndexes.map((levelIndex) => levelIndex + 1).join(", ")}`;
    }

    return "Niveaux : tous";
  }

  function getSyllableEntry(syllable) {
    return state.syllables.find((entry) => entry.text === syllable) || null;
  }

  function getLevels() {
    return config.levels || [];
  }

  function normalizeSyllable(syllable) {
    return String(syllable || "").trim().toLowerCase();
  }

  function showMessage(message) {
    elements.message.textContent = message;
  }
})();
