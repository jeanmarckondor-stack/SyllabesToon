window.SyllabesToonAudio = (() => {
  const audioCache = new Map();
  const TEACHER_VOICE_DB = "syllabestoon.teacherVoice.v1";
  const TEACHER_VOICE_STORE = "syllableAudio";

  function buildCandidates(syllable, config) {
    return config.audio.extensions.map((extension) => {
      return `${config.audio.syllablePath}/${syllable}.${extension}`;
    });
  }

  function playRecordedOrSpeak({ syllable, fallbackText, config }) {
    return playTeacherSyllableAudio(syllable)
      .then(() => ({ source: "teacher" }))
      .catch(() => playCurrentFallback({ syllable, fallbackText, config }));
  }

  function playCurrentFallback({ syllable, fallbackText, config }) {
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

  function playTeacherSyllableAudio(syllable) {
    return getTeacherSyllableAudio(syllable).then((audioBlob) => {
      if (!audioBlob) {
        return Promise.reject(new Error("No teacher audio found"));
      }

      return playAudioBlob(audioBlob);
    });
  }

  function getTeacherSyllableAudio(syllable) {
    if (!("indexedDB" in window)) {
      return Promise.resolve(null);
    }

    return useTeacherVoiceStore("readonly", (store) => store.get(syllable))
      .catch(() => null);
  }

  function useTeacherVoiceStore(mode, action) {
    return openTeacherVoiceDb().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(TEACHER_VOICE_STORE, mode);
        const store = transaction.objectStore(TEACHER_VOICE_STORE);
        const request = action(store);

        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error));
        transaction.addEventListener("complete", () => db.close());
        transaction.addEventListener("abort", () => {
          db.close();
          reject(transaction.error);
        });
      });
    });
  }

  function openTeacherVoiceDb() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(TEACHER_VOICE_DB, 1);

      request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore(TEACHER_VOICE_STORE);
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  }

  function playAudioBlob(audioBlob) {
    const source = URL.createObjectURL(audioBlob);

    return playAudio(source)
      .then(() => {
        window.setTimeout(() => URL.revokeObjectURL(source), 120000);
      })
      .catch((error) => {
        URL.revokeObjectURL(source);
        throw error;
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

  function playRewardTone(kind = "sparkle") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const now = context.currentTime;
    const patterns = {
      sparkle: [523.25, 659.25, 783.99, 1046.5],
      fanfare: [392, 523.25, 659.25, 783.99],
      bubble: [440, 554.37, 493.88, 659.25],
      soft: [329.63, 392, 493.88],
      launch: [196, 293.66, 392, 587.33, 783.99],
      rainbow: [392, 493.88, 587.33, 659.25, 783.99],
      parade: [523.25, 659.25, 523.25, 783.99, 1046.5],
      candy: [659.25, 783.99, 880, 783.99, 1046.5],
      drum: [146.83, 146.83, 220, 146.83, 329.63],
      spotlight: [261.63, 392, 523.25, 659.25],
    };
    const notes = patterns[kind] || patterns.sparkle;

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.11;
      const duration = 0.16;

      oscillator.type = kind === "drum" ? "square" : (index % 2 === 0 ? "sine" : "triangle");
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });

    window.setTimeout(() => context.close(), 900);
  }

  return {
    buildCandidates,
    playFirstAvailableAudio,
    playRecordedOrSpeak,
    playTeacherSyllableAudio,
    playRewardTone,
    speak,
  };
})();
