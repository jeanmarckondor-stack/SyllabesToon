window.SyllabesToonParkour = (() => {
  const key = "syllabestoon.parkours.v1";
  const modulesPerBlock = 3;
  const maxBlocks = 30;
  const config = window.SYLLABESTOON_CONFIG;
  const cleanName = (name) => typeof name === "string" ? name.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  const nameKey = (name) => cleanName(name).toLocaleLowerCase("fr");

  function optionalText(value) {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || !value.trim()) throw new Error("Choix invalide.");
    return value.trim();
  }

  function validate(definitions) {
    if (!Array.isArray(definitions)) throw new Error("Liste de Parkours invalide.");
    const names = new Set();
    return definitions.map((entry) => {
      const name = cleanName(entry?.name);
      if (!name || name.length > 24) throw new Error("Indiquez un prénom de 1 à 24 caractères.");
      if (names.has(nameKey(name))) throw new Error("Un Parkour existe déjà pour ce prénom.");
      names.add(nameKey(name));
      if (!Array.isArray(entry.blocks) || !entry.blocks.length || entry.blocks.length > maxBlocks) {
        throw new Error(`Choisissez de 1 à ${maxBlocks} blocs.`);
      }
      return {
        name,
        priority: optionalText(entry.priority),
        blocks: entry.blocks.map((block) => {
          if (!Array.isArray(block?.modules) || block.modules.length !== modulesPerBlock) {
            throw new Error("Chaque bloc doit contenir trois modules.");
          }
          return {
            modules: block.modules.map((module) => {
              if (!Number.isInteger(module?.levelIndex) || module.levelIndex < 0) throw new Error("Niveau invalide.");
              return { levelIndex: module.levelIndex, video: optionalText(module.video) };
            }),
            bonus: optionalText(block.bonus),
          };
        }),
      };
    });
  }

  function list() {
    const raw = window.localStorage.getItem(key);
    return raw === null ? [] : validate(JSON.parse(raw));
  }

  function replace(definitions) {
    window.localStorage.setItem(key, JSON.stringify(validate(definitions)));
  }

  function save(entry, originalKey = null) {
    const definitions = list();
    const index = definitions.findIndex(({ name }) => nameKey(name) === originalKey);
    if (originalKey !== null && index === -1) throw new Error("Ce Parkour n’existe plus.");
    if (index === -1) definitions.push(entry);
    else definitions[index] = entry;
    replace(definitions);
  }

  function remove(originalKey) {
    replace(list().filter(({ name }) => nameKey(name) !== originalKey));
  }

  function find(name) {
    return list().find((entry) => nameKey(entry.name) === nameKey(name));
  }

  function plan(definition, videos, catalog, session = null) {
    const entries = config.getSyllables();
    const levels = window.SyllabesToonPreparedSession.getLevels(session?.syllables ?? entries.map(({ text }) => text), entries);
    const activeVideos = new Set(config.getActiveRewardVideoFiles(videos));
    const bonusIds = catalog.map(({ id }) => id);
    const issues = [];
    const blocks = definition.blocks.map((block, blockIndex) => {
      const prefix = `Bloc ${blockIndex + 1}`;
      const bonuses = block.bonus ? bonusIds.filter((id) => id === block.bonus) : bonusIds;
      if (!bonuses.length) issues.push(`${prefix} : mini-jeu indisponible.`);
      return {
        bonuses,
        modules: block.modules.map(({ levelIndex, video }, index) => {
          const label = `${prefix}, module ${index + 1}`;
          const level = levels[levelIndex];
          if (!level) issues.push(`${label} : niveau ${levelIndex + 1} indisponible.`);
          else if (!level.playable) issues.push(`${label} : ${level.pool.length}/${level.minimum} syllabes compatibles au niveau ${levelIndex + 1}${session ? " dans la séance préparée" : ""}.`);
          // An explicit choice comes from the catalogue; activation and level filters govern the random draw.
          const rewards = video ? videos.filter(({ file }) => file === video) : videos.filter(({ file, levels: assigned }) => {
            const localLevels = config.getRewardVideoLevelIndexes(file);
            return activeVideos.has(file) && (!assigned || assigned.includes(levelIndex))
              && (!localLevels || localLevels.includes(levelIndex));
          });
          if (!rewards.length) issues.push(video
            ? `${label} : vidéo indisponible (${video.split("/").pop()}).`
            : `${label} : aucune vidéo active compatible avec le niveau ${levelIndex + 1}.`);
          return { levelIndex, rewards };
        }),
      };
    });
    return { levels, blocks, issues };
  }

  function priorityTurn(streak) {
    return streak === 1 || streak === 3;
  }

  return { modulesPerBlock, maxBlocks, cleanName, nameKey, validate, list, replace, save, remove, find, plan, priorityTurn };
})();
