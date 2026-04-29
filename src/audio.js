window.SyllabesToonAudio = (() => {
  const audioCache = new Map();

  function buildCandidates(syllable, config) {
    return config.audio.extensions.map((extension) => {
      return `${config.audio.syllablePath}/${syllable}.${extension}`;
    });
  }

  function playRecordedOrSpeak({ syllable, fallbackText, config }) {
    if (!config.audio.useRecordedVoiceFirst) {
      speak(fallbackText);
      return Promise.resolve({ source: "speech" });
    }

    return playFirstAvailableAudio(syllable, config)
      .then((source) => ({ source }))
      .catch(() => {
        speak(fallbackText);
        return { source: "speech" };
      });
  }

  function playFirstAvailableAudio(syllable, config) {
    return tryAudioCandidates(buildCandidates(syllable, config));
  }

  function tryAudioCandidates(candidates) {
    const [candidate, ...remaining] = candidates;

    if (!candidate) {
      return Promise.reject(new Error("No recorded audio found"));
    }

    return playAudio(candidate)
      .then(() => candidate)
      .catch(() => tryAudioCandidates(remaining));
  }

  function playAudio(source) {
    return new Promise((resolve, reject) => {
      const audio = getAudio(source);
      let settled = false;
      const failTimer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Audio timeout: ${source}`));
        }
      }, 900);

      audio.pause();
      audio.currentTime = 0;

      audio.addEventListener("playing", () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(failTimer);
          resolve();
        }
      }, { once: true });

      audio.addEventListener("error", () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(failTimer);
          reject(new Error(`Audio error: ${source}`));
        }
      }, { once: true });

      audio.play().catch((error) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(failTimer);
          reject(error);
        }
      });
    });
  }

  function getAudio(source) {
    if (!audioCache.has(source)) {
      audioCache.set(source, new Audio(source));
    }

    return audioCache.get(source);
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

  return {
    buildCandidates,
    playFirstAvailableAudio,
    playRecordedOrSpeak,
    speak,
  };
})();
