const audioList = document.querySelector("#audioList");
const config = window.SYLLABESTOON_CONFIG;

function renderAudioRows() {
  audioList.innerHTML = "";

  config.syllables.forEach((syllable) => {
    const row = document.createElement("article");
    row.className = "audio-row";

    const label = document.createElement("strong");
    label.className = "audio-syllable";
    label.textContent = syllable;

    const paths = document.createElement("p");
    paths.className = "audio-paths";
    paths.textContent = window.SyllabesToonAudio.buildCandidates(syllable, config).join("  |  ");

    const status = document.createElement("span");
    status.className = "audio-status waiting";
    status.textContent = "Non testé";

    const playButton = document.createElement("button");
    playButton.className = "audio-test-button";
    playButton.type = "button";
    playButton.textContent = "Tester";
    playButton.addEventListener("click", () => testSyllable(syllable, status));

    row.append(label, paths, status, playButton);
    audioList.appendChild(row);
  });
}

function testSyllable(syllable, status) {
  status.className = "audio-status testing";
  status.textContent = "Test...";

  window.SyllabesToonAudio.playFirstAvailableAudio(syllable, config)
    .then((source) => {
      status.className = "audio-status ok";
      status.textContent = `OK: ${source}`;
    })
    .catch(() => {
      status.className = "audio-status missing";
      status.textContent = "Fichier absent ou illisible";
      window.SyllabesToonAudio.speak(syllable);
    });
}

renderAudioRows();
