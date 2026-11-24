window.SyllabesToonBonusGames = (() => {
  const games = [
    { id: "space", title: "Space Invaders Toon", start: startSpaceBonus },
    { id: "maze", title: "Labyrinthe des bonbons", start: startCandyMaze },
    { id: "bike", title: "Vélo Turbo Toon", start: startTurboBike },
    { id: "golf", title: "Mini-golf farfelu", start: startFunnyGolf },
  ];
  const catalog = games.map(({ id, title }) => ({ id, title }));
  const dialog = document.createElement("dialog");
  dialog.id = "spaceBonus";
  dialog.className = "space-bonus";
  dialog.innerHTML = `
    <section id="spaceBonusOffer" class="space-bonus-offer">
      <h2 id="spaceBonusOfferTitle">Bravo ! Tu as gagn&eacute; un petit jeu !</h2>
      <p id="spaceBonusOfferGame"></p>
      <div class="space-bonus-actions">
        <button id="spaceBonusYes" class="space-bonus-primary" type="button">Oui, je joue !</button>
        <button id="spaceBonusNo" class="space-bonus-secondary" type="button">Non, continuer</button>
        <button class="space-bonus-secondary parkour-abandon-bonus" type="button" hidden>Quitter le Parkour</button>
      </div>
    </section>
    <section id="spaceBonusGame" class="space-bonus-game" hidden>
      <header class="space-bonus-bar">
        <h2 id="spaceBonusGameTitle"></h2>
        <p id="spaceBonusProgress" role="status"></p>
        <button id="spaceBonusQuit" class="space-bonus-secondary" type="button"></button>
        <button class="space-bonus-secondary parkour-abandon-bonus" type="button" hidden>Quitter le Parkour</button>
      </header>
      <div id="spaceBonusArena" class="space-bonus-arena"></div>
      <footer class="space-bonus-controls"></footer>
    </section>
  `;
  document.body.append(dialog);
  const offer = dialog.querySelector("#spaceBonusOffer");
  const no = dialog.querySelector("#spaceBonusNo");
  const game = dialog.querySelector("#spaceBonusGame");
  const arena = dialog.querySelector("#spaceBonusArena");
  const controls = dialog.querySelector(".space-bonus-controls");
  const progress = dialog.querySelector("#spaceBonusProgress");
  const quit = dialog.querySelector("#spaceBonusQuit");
  const abandonButtons = dialog.querySelectorAll(".parkour-abandon-bonus");
  let earnedVideos = 0;
  let nextGame = 0;
  let selection;
  let returnFocus;
  let previewMode;
  let round;
  let returnTimer;
  let parkourActions;

  function show(entry, trigger, preview, actions = null) {
    if (dialog.open) return false;
    selection = entry;
    returnFocus = trigger;
    previewMode = preview;
    parkourActions = actions;
    dialog.toggleAttribute("data-parkour-bonus", Boolean(actions));
    abandonButtons.forEach((button) => { button.hidden = !actions; });
    dialog.querySelector("#spaceBonusOfferGame").textContent = entry.title;
    quit.textContent = preview ? "Retour à l'espace enseignant" : actions ? "Quitter le mini-jeu" : "Quitter";
    dialog.setAttribute("aria-labelledby", "spaceBonusOfferTitle");
    dialog.showModal();
    if (preview) start();
    else no.focus({ preventScroll: true });
    return true;
  }

  function start() {
    offer.hidden = true;
    game.hidden = false;
    game.dataset.bonus = selection.id;
    dialog.classList.add("is-playing");
    dialog.setAttribute("aria-labelledby", "spaceBonusGameTitle");
    dialog.querySelector("#spaceBonusGameTitle").textContent = selection.title;
    round = new AbortController();
    selection.start({
      dialog, arena, controls, signal: round.signal,
      onProgress: (hits, goal) => { progress.textContent = `${hits} / ${goal}`; },
      onWin: celebrate,
    });
  }

  function celebrate(message) {
    round.abort();
    const finish = document.createElement("div");
    finish.id = "spaceBonusFinish";
    finish.className = "space-bonus-finish";
    finish.innerHTML = `
      <span class="space-bonus-win-star" aria-hidden="true">&#10022;</span>
      <h3></h3>
      <button id="spaceBonusReturn" class="space-bonus-primary" type="button"></button>
    `;
    finish.querySelector("h3").textContent = message;
    const back = finish.querySelector("button");
    back.textContent = previewMode ? quit.textContent : "Retour aux syllabes";
    back.addEventListener("click", close);
    arena.append(finish);
    back.focus({ preventScroll: true });
    returnTimer = window.setTimeout(close, 3400);
  }

  function close() {
    if (!dialog.open) return;
    window.clearTimeout(returnTimer);
    round?.abort();
    round = null;
    if (!game.hidden) window.SyllabesToonAudio.stopProgressChime();
    dialog.close();
    arena.replaceChildren();
    controls.replaceChildren();
    offer.hidden = false;
    game.hidden = true;
    dialog.classList.remove("is-playing");
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
    const completed = parkourActions?.complete;
    parkourActions = null;
    completed?.();
  }

  dialog.querySelector("#spaceBonusYes").addEventListener("click", start);
  no.addEventListener("click", close);
  quit.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  abandonButtons.forEach((button) => button.addEventListener("click", () => {
    const abandon = parkourActions?.abandon;
    parkourActions = null;
    close();
    abandon?.();
  }));
  window.addEventListener("pagehide", () => {
    parkourActions = null;
    close();
  });

  function rewardClosed() {
    earnedVideos += 1;
    if (earnedVideos < 3) return false;
    if (!show(games[nextGame], document.querySelector("#nextRound"), false)) return false;
    earnedVideos = 0;
    nextGame = (nextGame + 1) % games.length;
    return true;
  }

  function preview(id, trigger) {
    const entry = games.find((item) => item.id === id);
    if (entry) show(entry, trigger, true);
  }

  function offerParkourBonus(id, trigger, actions) {
    const entry = games.find((item) => item.id === id);
    return Boolean(entry && show(entry, trigger, false, actions));
  }

  return { catalog, rewardClosed, preview, offerParkourBonus };
})();
