window.SyllabesToonAudio = (() => {
  const audioCache = new Map();
  const TEACHER_VOICE_DB = "syllabestoon.teacherVoice.v1";
  const TEACHER_VOICE_STORE = "syllableAudio";
  let progressChimeContext = null;
  let progressChimeTimer;

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
    const isProgressChime = kind === "progress";
    if (isProgressChime) progressChimeContext = context;
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
      progress: [659.25, 783.99, 987.77],
    };
    const notes = patterns[kind] || patterns.sparkle;

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * (isProgressChime ? 0.08 : 0.11);
      const duration = isProgressChime ? 0.12 : 0.16;

      oscillator.type = kind === "drum" ? "square" : (isProgressChime || index % 2 === 0 ? "sine" : "triangle");
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(isProgressChime ? 0.035 : 0.08, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });

    const timer = window.setTimeout(() => {
      if (progressChimeContext === context) {
        progressChimeContext = null;
        progressChimeTimer = undefined;
      }
      if (context.state !== "closed") context.close().catch(() => {});
    }, isProgressChime ? 320 : 900);
    if (isProgressChime) progressChimeTimer = timer;
  }

  function stopProgressChime() {
    window.clearTimeout(progressChimeTimer);
    progressChimeTimer = undefined;
    const context = progressChimeContext;
    progressChimeContext = null;
    if (context && context.state !== "closed") context.close().catch(() => {});
  }

  function playProgressChime() {
    stopProgressChime();
    try {
      playRewardTone("progress");
    } catch {
      stopProgressChime();
    }
  }

  const arcadeEffects = {
    pellet: [[660, 830, 990], 0.075, 0.12, 0.042, "sine"],
    caught: [[740, 587, 494, 392, 294, 196], 0.126, 0.19, 0.38, "triangle", 0.76],
    launch: [[294, 415, 622], 0.055, 0.14, 0.16, "triangle", 1.11],
    roll: [[105, 97, 88, 80], 0.16, 0.19, 0.035, "triangle"],
    impact: [[165, 250], 0.057, 0.16, 0.25, "triangle", 0.78],
    clack: [[410, 319], 0.047, 0.084, 0.115, "triangle", 0.79],
    round: [[392, 494, 587, 784], 0.1, 0.21, 0.19, "sine"],
    strike: [[392, 523, 659, 784, 1047], 0.093, 0.24, 0.24, "triangle"],
    victory: [[523, 659, 784, 659, 880, 1047], 0.12, 0.27, 0.22, "triangle"],
    "fish-cast": [[330, 495, 660], 0.04, 0.105, 0.09, "sine", 1.13],
    "fish-hook": [[490, 370, 550], 0.056, 0.11, 0.12, "sine", 1.17],
    "fish-land": [[523, 659, 784], 0.085, 0.20, 0.15, "triangle"],
    "fish-win": [[440, 587, 740, 880, 988], 0.13, 0.24, 0.16, "triangle"],
    "brick-paddle": [[294, 392], 0.032, 0.086, 0.12, "sine", 1.16],
    "brick-wall": [[352], 0.05, 0.063, 0.06, "triangle", 0.89],
    "brick-brick": [[523, 784], 0.054, 0.13, 0.14, "triangle", 1.09],
    "brick-star": [[659, 880, 1109], 0.072, 0.17, 0.15, "sine"],
    "brick-miss": [[440, 349, 263], 0.072, 0.13, 0.095, "triangle", 0.84],
    "brick-last": [[392, 659, 988], 0.06, 0.14, 0.16, "triangle"],
    "brick-fanfare": [[392, 523, 659, 587, 784, 1047], 0.112, 0.25, 0.19, "triangle"],
  };

  function makeArcadeLoop(context, theme) {
    const fishing = theme === "fishing";
    const bricks = theme === "bricks";
    const beat = fishing ? 0.52 : bricks ? 0.395 : 0.43;
    const rate = 22050;
    const buffer = context.createBuffer(1, Math.round(rate * beat * 32), rate);
    const samples = buffer.getChannelData(0);
    const melody = bricks ? [
      [67, 71, 74, 0, 79, 76, 74, 71], [64, 67, 71, 0, 76, 74, 71, 67],
      [65, 69, 72, 0, 76, 74, 72, 69], [67, 71, 74, 0, 77, 74, 71, 0],
      [71, 74, 79, 83, 79, 76, 74, 0], [67, 71, 76, 79, 76, 74, 71, 0],
      [65, 69, 72, 77, 76, 74, 72, 0], [67, 71, 74, 0, 77, 76, 74, 0],
    ] : fishing ? [
      [69, 0, 74, 76, 0, 74, 71, 0], [67, 0, 71, 74, 0, 69, 66, 0],
      [66, 0, 69, 71, 74, 0, 69, 0], [64, 0, 67, 71, 0, 73, 69, 0],
      [69, 0, 74, 78, 76, 0, 74, 0], [67, 0, 71, 74, 78, 0, 74, 0],
      [66, 0, 71, 74, 0, 71, 69, 0], [67, 0, 71, 73, 0, 69, 0, 0],
    ] : [
      [72, 76, 79, 81, 79, 76, 74, 0], [69, 72, 76, 79, 76, 72, 74, 0],
      [65, 69, 72, 76, 74, 72, 69, 0], [67, 71, 74, 79, 77, 74, 71, 0],
      [72, 76, 79, 84, 81, 79, 76, 0], [69, 72, 76, 81, 79, 76, 72, 0],
      [65, 69, 72, 77, 76, 74, 72, 0], [67, 74, 77, 76, 74, 71, 67, 0],
    ];
    function pluck(midi, start, duration, level, bell) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const first = Math.round(start * rate);
      const length = Math.round(duration * rate);
      for (let i = 0; i < length && first + i < samples.length; i += 1) {
        const wave = 2 * Math.PI * frequency * i / rate;
        const overtones = Math.sin(wave * 2) * 0.18 + (bell ? Math.sin(wave * 3.01) * 0.14 : 0);
        const envelope = Math.min(i / 125, 1) * (1 - i / length) ** 2.4;
        samples[first + i] += (Math.sin(wave) + overtones) * level * envelope;
      }
    }
    melody.forEach((bar, index) => {
      const first = index * 4 * beat;
      const bass = (fishing ? [50, 47, 43, 45] : bricks ? [43, 40, 41, 43] : [48, 45, 41, 43])[index % 4];
      bar.forEach((note, i) => { if (note) pluck(note, first + i * beat / 2, beat * 0.67, i % 2 ? 0.19 : 0.26, true); });
      pluck(bass, first, beat * 1.3, 0.25, false);
      pluck(bass + 7, first + 2 * beat, beat, 0.17, false);
      pluck(bass + 12, first + 3 * beat, beat * 0.7, 0.16, false);
    });
    return buffer;
  }

  function createArcadeAudio(signal, theme = "arcade") {
    let context;
    let master;
    let resuming;
    let loop;
    let song;
    let wantsMusic = false;
    let generation = 0;
    const active = new Set();

    function stopMusic() {
      if (!loop) return;
      loop.stop();
      loop.disconnect();
      loop = null;
    }

    function startMusic() {
      if (!wantsMusic || loop || context?.state !== "running" || signal.aborted) return;
      song ??= makeArcadeLoop(context, theme);
      loop = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = theme === "fishing" ? 0.17 : theme === "bricks" ? 0.19 : 0.22;
      loop.buffer = song;
      loop.loop = true;
      loop.connect(gain);
      gain.connect(master);
      loop.onended = () => gain.disconnect();
      loop.start();
    }

    function unlock() {
      if (signal.aborted) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!context) {
          context = new AudioContextClass();
          master = context.createGain();
          master.gain.value = 0.74;
          master.connect(context.destination);
        }
        if (context.state === "running") {
          startMusic();
        } else if (!resuming) {
          resuming = context.resume().then(startMusic, () => {}).finally(() => { resuming = null; });
        }
      } catch { /* Audio is optional when the device does not allow it. */ }
      return resuming;
    }

    function play(kind) {
      const effect = arcadeEffects[kind];
      if (!effect || signal.aborted || !context) return;
      const turn = generation;
      function schedule() {
        if (signal.aborted || generation !== turn || context.state !== "running") return;
        const [notes, spacing, duration, volume, wave, bend = 1] = effect;
        const now = context.currentTime + 0.018;
        notes.forEach((frequency, i) => {
          const voice = context.createOscillator();
          const gain = context.createGain();
          const start = now + spacing * i;
          const end = start + duration;
          voice.type = wave;
          voice.frequency.setValueAtTime(frequency, start);
          if (bend !== 1) voice.frequency.exponentialRampToValueAtTime(frequency * bend, end);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(volume, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(volume * 0.56, start + duration * 0.48);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          voice.connect(gain);
          gain.connect(master);
          active.add(voice);
          voice.onended = () => { active.delete(voice); voice.disconnect(); gain.disconnect(); };
          voice.start(start);
          voice.stop(end + 0.01);
        });
      }
      if (context.state === "running") schedule();
      else unlock()?.then(schedule).catch(() => {});
    }

    function stopEffects() {
      generation += 1;
      for (const voice of active) { voice.stop(); voice.disconnect(); }
      active.clear();
    }

    function music(enabled) {
      wantsMusic = enabled;
      if (enabled) unlock();
      else stopMusic();
    }

    signal.addEventListener("abort", () => {
      stopEffects();
      stopMusic();
      if (context && context.state !== "closed") context.close().catch(() => {});
    }, { once: true });
    return { unlock, play, stopEffects, music };
  }

  return {
    buildCandidates,
    playFirstAvailableAudio,
    playRecordedOrSpeak,
    playTeacherSyllableAudio,
    playRewardTone,
    playProgressChime,
    stopProgressChime,
    createArcadeAudio,
    speak,
  };
})();
