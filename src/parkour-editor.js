function bindParkourEditor(panel) {
  const parkours = window.SyllabesToonParkour;
  const config = window.SYLLABESTOON_CONFIG;
  const catalog = window.SyllabesToonBonusGames.catalog;
  const find = (selector) => panel.querySelector(selector);
  const form = find("form");
  const name = find("#parkourName");
  const priority = find("#parkourPriority");
  const count = find("#parkourBlockCount");
  const blocks = find("#parkourBlocks");
  const list = find("#parkourList");
  const status = find("#parkourEditorStatus");
  let videos = [];
  let editing = null;
  let draft = [];

  function freshBlock() {
    const levels = window.SyllabesToonPreparedSession.getLevels(config.getActiveSyllables());
    const levelIndex = Math.max(0, levels.findIndex((level) => level.playable));
    return { bonus: null, modules: Array.from({ length: parkours.modulesPerBlock }, () => ({ levelIndex, video: null })) };
  }

  function optionLabel(file) {
    return file.split("/").pop();
  }

  function selectedLabel(label, options, value, field, change) {
    const wrapper = document.createElement("label");
    const text = document.createElement("span");
    const select = document.createElement("select");
    text.textContent = label;
    select.dataset.field = field;
    select.append(...options);
    if (![...select.options].some((option) => option.value === String(value))) {
      select.add(new Option(`Indisponible : ${optionLabel(String(value))}`, value));
    }
    select.value = value;
    select.addEventListener("change", () => change(select.value));
    wrapper.append(text, select);
    return wrapper;
  }

  function renderDraft(savedPriority = priority.value) {
    const syllables = [...config.getSyllableTexts()].sort((a, b) => a.localeCompare(b, "fr"));
    priority.replaceChildren(new Option("Aucune", ""), ...syllables.map((text) => new Option(text, text)));
    if (savedPriority && !syllables.includes(savedPriority)) priority.add(new Option(`Indisponible : ${savedPriority}`, savedPriority));
    priority.value = savedPriority ?? "";
    const size = count.valueAsNumber;
    if (!Number.isInteger(size) || size < 1 || size > parkours.maxBlocks) return;
    let defaultBlock;
    while (draft.length < size) {
      defaultBlock ??= freshBlock();
      draft.push({ bonus: null, modules: defaultBlock.modules.map((module) => ({ ...module })) });
    }
    blocks.replaceChildren(...draft.slice(0, size).map((block, i) => {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = `Bloc ${i + 1}`;
      fieldset.append(legend);
      block.modules.forEach((module, j) => {
        const row = document.createElement("div");
        row.className = "parkour-module-row";
        row.append(
          selectedLabel(`Module ${j + 1} · Niveau`, config.levels.map((level, index) => new Option(level.name, index)),
            module.levelIndex, "level", (value) => { module.levelIndex = Number(value); }),
          selectedLabel("Vidéo", [new Option("Aléatoire", ""), ...videos.map(({ file }) => new Option(optionLabel(file), file))],
            module.video ?? "", "video", (value) => { module.video = value || null; }),
        );
        fieldset.append(row);
      });
      fieldset.append(selectedLabel("Mini-jeu du bloc",
        [new Option("Aléatoire", ""), ...catalog.map(({ id, title }) => new Option(title, id))],
        block.bonus ?? "", "bonus", (value) => { block.bonus = value || null; }));
      return fieldset;
    }));
  }

  function loadDraft(entry = null) {
    editing = entry ? parkours.nameKey(entry.name) : null;
    name.value = entry?.name ?? "";
    count.value = entry?.blocks.length ?? 1;
    draft = entry?.blocks ?? [];
    renderDraft(entry?.priority ?? "");
    status.textContent = "";
    name.focus();
  }

  function renderList() {
    try {
      const entries = parkours.list().sort((a, b) => a.name.localeCompare(b.name, "fr"));
      list.replaceChildren(...entries.map((entry) => {
        const row = document.createElement("li");
        const details = document.createElement("div");
        const title = document.createElement("strong");
        const summary = document.createElement("small");
        const issue = parkours.plan(entry, videos, catalog).issues[0];
        title.textContent = entry.name;
        summary.textContent = issue || `${entry.blocks.length} bloc${entry.blocks.length > 1 ? "s" : ""}`;
        if (issue) summary.classList.add("parkour-warning");
        details.append(title, summary);
        const actions = document.createElement("div");
        for (const [label, action] of [
          ["Modifier", () => loadDraft(entry)],
          ["Supprimer", () => {
            if (!window.confirm(`Supprimer le Parkour de ${entry.name} ?`)) return;
            try {
              const key = parkours.nameKey(entry.name);
              parkours.remove(key);
              if (editing === key) loadDraft();
              renderList();
              status.textContent = "Parkour supprimé.";
            } catch (error) {
              status.textContent = error.message;
            }
          }],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "audio-test-button";
          button.textContent = label;
          button.setAttribute("aria-label", `${label} le Parkour de ${entry.name}`);
          button.addEventListener("click", action);
          actions.append(button);
        }
        row.append(details, actions);
        return row;
      }));
      if (!entries.length) {
        const empty = document.createElement("li");
        empty.textContent = "Aucun Parkour enregistré.";
        list.append(empty);
      }
    } catch {
      status.textContent = "Les Parkours enregistrés ne peuvent pas être lus.";
    }
  }

  count.max = parkours.maxBlocks;
  count.addEventListener("change", () => renderDraft());
  find("#newParkour").addEventListener("click", () => loadDraft());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      renderDraft();
      const entry = { name: name.value, priority: priority.value || null, blocks: draft.slice(0, count.valueAsNumber) };
      const checked = parkours.validate([entry])[0];
      parkours.save(checked, editing);
      editing = parkours.nameKey(checked.name);
      name.value = checked.name;
      const issue = parkours.plan(checked, videos, catalog).issues[0];
      renderList();
      status.textContent = issue ? `Parkour enregistré, à corriger avant de jouer. ${issue}` : "Parkour enregistré.";
    } catch (error) {
      status.textContent = error.message;
    }
  });

  return async function refresh() {
    videos = await config.getAvailableRewardVideos();
    renderDraft();
    renderList();
  };
}
