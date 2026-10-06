// Procedural Live Web Audio score; no fetched audio or prerecorded samples.
// Real-time sound design synced to the 118-second cinematic master timeline.
import { clampTime, DURATION } from '../timeline/config';

export interface CinemaAudio {
  prepare: () => Promise<void>;
  play: (time: number) => void;
  pause: () => void;
  seek: (time: number) => void;
  sync: (time: number) => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
}

const pitch = (note: number) => 440 * 2 ** ((note - 69) / 12);

// Harmonies matching the 6 chapters:
// [start, end, bass MIDI, chord MIDI]
export const HARMONIES: [number, number, number, number[]][] = [
  // ORIGIN 0–12
  [0, 4, 26, [50, 57, 64]],
  [4, 8, 26, [50, 53, 57, 64]],
  [8, 12, 33, [48, 52, 57, 62]],
  // CODEX 12–35
  [12, 18, 26, [50, 53, 57, 60]],
  [18, 23, 34, [50, 53, 57, 62]],
  [23, 28, 29, [48, 53, 57, 64]],
  [28, 32, 33, [50, 55, 57, 64]],
  [32, 35, 33, [49, 55, 57, 64]],
  // CLAUDE 35–58
  [35, 40, 29, [53, 57, 60, 64]],
  [40, 45, 33, [52, 55, 59, 60]],
  [45, 50, 31, [50, 55, 57, 62]],
  [50, 54, 36, [52, 55, 59, 62]],
  [54, 58, 38, [50, 55, 57, 64]],
  // GEMINI 58–81
  [58, 63, 31, [55, 59, 62, 66, 69]],
  [63, 68, 38, [54, 57, 61, 64, 69]],
  [68, 73, 40, [55, 59, 62, 66, 71]],
  [73, 78, 36, [55, 59, 62, 66, 69]],
  [78, 81, 38, [54, 57, 62, 64, 69]],
  // GROK 81–103
  [81, 86, 24, [48, 51, 55, 62]],
  [86, 91, 32, [48, 51, 55, 58]],
  [91, 94.5, 31, [50, 53, 55, 58]],
  [96, 100, 24, [48, 51, 55, 62]],
  [100, 103, 33, [49, 55, 58, 64]],
  // CONVERGENCE 103–118
  [104, 107, 26, [50, 53, 57, 64]],
  [107, 111, 34, [53, 57, 60, 65]],
  [111, 114, 31, [55, 59, 62, 69]],
  [114, 118, 26, [50, 54, 57, 64, 69]],
];

export const RHYTHMS: [number, number, number, number[], number][] = [
  [12, 35, 0.625, [50, 57, 62, 65, 69, 65, 62, 57], 0.065],
  [35, 58, 0.75, [53, 60, 64, 69, 67, 64, 60, 57], 0.045],
  [58, 81, 0.5, [67, 74, 78, 81, 78, 74, 71, 66], 0.055],
  [81, 94.4, 0.3125, [48, 55, 60, 63, 62, 55, 58, 51], 0.06],
  [96, 103, 0.3125, [48, 55, 60, 67, 63, 60, 62, 55], 0.07],
  [104, 116, 0.375, [62, 69, 74, 78, 81, 78, 74, 69], 0.065],
];

export const CUES = [4, 8, 12, 18, 23, 28, 32, 35, 40, 45, 50, 54, 58, 63, 68, 73, 78, 81, 86, 91, 96, 100, 103, 107, 111, 114];

export function createCinemaAudio(onUnavailable: () => void): CinemaAudio {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let masterComp: DynamicsCompressorNode | null = null;
  let gate: GainNode | null = null;
  let output: GainNode | null = null;
  let bellWave: PeriodicWave | null = null;
  let noiseBuffer: AudioBuffer | null = null;

  let playing = false;
  let muted = false;
  let disposed = false;
  let failed = false;
  let position = 0;
  let lastTimelineTime = -1;
  let currentHarmonyIndex = -1;
  let lastRhythmStep = -1;

  interface Voice {
    stop: () => void;
    disconnect: () => void;
  }
  let activeChordVoices: Voice[] = [];

  const ramp = (param: AudioParam, value: number, duration = 0.015) => {
    if (!ctx) return;
    const current = param.value;
    param.cancelScheduledValues(ctx.currentTime);
    param.setValueAtTime(current, ctx.currentTime);
    param.linearRampToValueAtTime(value, ctx.currentTime + duration);
  };

  const unavailable = () => {
    if (disposed || failed) return;
    failed = true;
    playing = false;
    stopChordVoices();
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    onUnavailable();
  };

  function ensureGraph(): AudioContext {
    if (ctx && ctx.state !== 'closed') return ctx;
    ctx = new AudioContext({ latencyHint: 'interactive' });

    masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -18;
    masterComp.knee.value = 8;
    masterComp.ratio.value = 3.5;
    masterComp.attack.value = 0.005;
    masterComp.release.value = 0.2;

    gate = ctx.createGain();
    gate.gain.value = 1;
    masterComp.connect(gate);

    output = ctx.createGain();
    output.gain.value = muted ? 0 : 0.55;
    gate.connect(output);
    output.connect(ctx.destination);

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(masterComp);

    // Stereo space delays (feed-forward stereo ambience)
    for (const [seconds, feedback, pan] of [[0.19, 0.25, -0.7], [0.27, 0.22, 0.7]]) {
      const delay = ctx.createDelay();
      delay.delayTime.value = seconds;
      const shade = ctx.createBiquadFilter();
      shade.type = 'lowpass';
      shade.frequency.value = 2400;
      const spread = ctx.createStereoPanner();
      spread.pan.value = pan;
      const gain = ctx.createGain();
      gain.gain.value = feedback;

      masterGain.connect(delay);
      delay.connect(shade);
      shade.connect(spread);
      spread.connect(gain);
      gain.connect(masterComp);
    }

    bellWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.16, 0.09, 0.04]));

    // Fast 2s noise buffer for impacts and textures
    const rate = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(2, Math.floor(rate * 2), rate);
    let seed = 1984;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2147483648 - 1;
    };
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = rnd();
        b0 = 0.99886 * b0 + white * 0.0555;
        b1 = 0.99332 * b1 + white * 0.075;
        b2 = 0.96900 * b2 + white * 0.153;
        data[i] = (b0 + b1 + b2 + white * 0.3) * 0.1;
      }
    }

    return ctx;
  }

  function triggerChime(freq: number, decay = 0.8, vol = 0.08, pan = 0) {
    if (!ctx || !masterGain || !bellWave) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const spread = ctx.createStereoPanner();
    osc.setPeriodicWave(bellWave);
    osc.frequency.setValueAtTime(freq, now);
    spread.pan.value = pan;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(gain);
    gain.connect(spread);
    spread.connect(masterGain);
    osc.start(now);
    osc.stop(now + decay);
  }

  function triggerImpact(baseFreq = 80, length = 1.2, vol = 0.35) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + length);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + length);

    if (noiseBuffer) {
      const src = ctx.createBufferSource();
      const flt = ctx.createBiquadFilter();
      const nGain = ctx.createGain();
      src.buffer = noiseBuffer;
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(300, now);
      nGain.gain.setValueAtTime(vol * 0.4, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      src.connect(flt);
      flt.connect(nGain);
      nGain.connect(masterGain);
      src.start(now);
      src.stop(now + 0.3);
    }
  }

  function triggerTexture(duration = 0.2, vol = 0.1, fromFreq = 3000, toFreq = 800) {
    if (!ctx || !masterGain || !noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    const flt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    flt.type = 'bandpass';
    flt.Q.value = 1.0;
    flt.frequency.setValueAtTime(fromFreq, now);
    flt.frequency.exponentialRampToValueAtTime(toFreq, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    src.connect(flt);
    flt.connect(gain);
    gain.connect(masterGain);
    src.start(now);
    src.stop(now + duration);
  }

  function triggerRiser(duration = 1.2, vol = 0.08) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + duration * 0.85);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  function stopChordVoices() {
    for (const v of activeChordVoices) {
      try {
        v.stop();
        v.disconnect();
      } catch {}
    }
    activeChordVoices = [];
    currentHarmonyIndex = -1;
  }

  function startHarmony(hIdx: number) {
    if (!ctx || !masterGain || hIdx < 0 || hIdx >= HARMONIES.length) return;
    stopChordVoices();
    currentHarmonyIndex = hIdx;
    const [start, , root, notes] = HARMONIES[hIdx];
    const now = ctx.currentTime;
    const technical = (start >= 12 && start < 35) || (start >= 81 && start < 103);

    // Sub-bass drone
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.value = pitch(root);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(start < 12 ? 0.16 : 0.24, now + 0.3);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(now);

    activeChordVoices.push({
      stop: () => {
        try {
          if (ctx) {
            subGain.gain.cancelScheduledValues(ctx.currentTime);
            subGain.gain.setValueAtTime(0, ctx.currentTime);
            subOsc.stop(ctx.currentTime);
          }
        } catch {}
      },
      disconnect: () => {
        try { subOsc.disconnect(); subGain.disconnect(); } catch {}
      },
    });

    // Chord pad notes
    notes.forEach((note, idx) => {
      if (!ctx || !masterGain) return;
      const freq = pitch(note);
      const pan = (idx / Math.max(1, notes.length - 1) - 0.5) * 1.2;
      const padGain = ctx.createGain();
      const padFilter = ctx.createBiquadFilter();
      const padSpread = ctx.createStereoPanner();

      padFilter.type = 'lowpass';
      padFilter.frequency.value = freq * 3.2;
      padFilter.Q.value = 0.65;
      padSpread.pan.value = pan;
      padGain.gain.setValueAtTime(0.0001, now);
      padGain.gain.linearRampToValueAtTime(start < 12 ? 0.055 : 0.085, now + 0.4);

      padFilter.connect(padGain);
      padGain.connect(padSpread);
      padSpread.connect(masterGain);

      const oscs: OscillatorNode[] = [];
      for (const cents of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = technical ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(padFilter);
        osc.start(now);
        oscs.push(osc);
      }

      activeChordVoices.push({
        stop: () => {
          try {
            if (ctx) {
              padGain.gain.cancelScheduledValues(ctx.currentTime);
              padGain.gain.setValueAtTime(0, ctx.currentTime);
              for (const osc of oscs) osc.stop(ctx.currentTime);
            }
          } catch {}
        },
        disconnect: () => {
          try {
            for (const osc of oscs) osc.disconnect();
            padFilter.disconnect();
            padGain.disconnect();
            padSpread.disconnect();
          } catch {}
        },
      });
    });
  }

  function sync(time: number) {
    position = clampTime(time);
    if (disposed || failed) return;
    if (!ctx) ensureGraph();
    if (!playing || ctx?.state !== 'running' || !gate) return;

    // Gate control: Grok freeze (94.5–96s) & Convergence breath (103–104s) & Finale fade (116–118s)
    if ((position >= 94.5 && position < 96) || (position >= 103 && position < 104)) {
      gate.gain.setValueAtTime(0, ctx.currentTime);
      stopChordVoices();
      lastTimelineTime = position;
      return;
    } else if (position >= 116) {
      const fade = Math.max(0, 1 - (position - 116) / 2);
      gate.gain.setValueAtTime(fade, ctx.currentTime);
    } else {
      gate.gain.setValueAtTime(1, ctx.currentTime);
    }

    // Active harmony check
    let hIdx = -1;
    for (let i = 0; i < HARMONIES.length; i++) {
      if (position >= HARMONIES[i][0] && position < HARMONIES[i][1]) {
        hIdx = i;
        break;
      }
    }
    if (hIdx !== currentHarmonyIndex && hIdx !== -1) {
      startHarmony(hIdx);
    }

    // Rhythm pulses
    for (const [start, end, beat, notes, vol] of RHYTHMS) {
      if (position >= start && position < end) {
        const step = Math.floor((position - start) / beat);
        if (step !== lastRhythmStep) {
          lastRhythmStep = step;
          const build = start === 104 ? 0.65 + (position - start) / 16 : 1;
          if (step % 8 !== 6) {
            triggerChime(pitch(notes[step % notes.length]), beat * 1.2, vol * build, Math.sin(step * 1.7) * 0.65);
          }
          if (step % 4 === 0) {
            triggerImpact(64, 0.3, 0.15 * build);
          }
          if (step % 2 === 1) {
            triggerTexture(0.08, 0.12 * build, 4200, 6500);
          }
        }
      }
    }

    // Cues check
    if (lastTimelineTime >= 0 && position > lastTimelineTime) {
      for (let c = 0; c < CUES.length; c++) {
        const cueTime = CUES[c];
        if (lastTimelineTime < cueTime && position >= cueTime) {
          const isChapter = [12, 35, 58, 81, 103, 114].includes(cueTime);
          if (cueTime === 96) {
            triggerChime(pitch(79), 1.1, 0.09, -0.4);
            triggerChime(pitch(86), 0.8, 0.05, 0.4);
            triggerImpact(88, 1.6, 0.4);
          } else if (cueTime === 104) {
            triggerImpact(72, 2.4, 0.5);
            triggerTexture(0.8, 0.5, 3800, 180);
          } else if (cueTime === 114) {
            triggerRiser(2.0, 0.1);
            triggerChime(pitch(86), 3.0, 0.09, 0.45);
          } else {
            triggerImpact(isChapter ? 88 : 68, isChapter ? 1.6 : 0.9, isChapter ? 0.42 : 0.25);
            triggerTexture(isChapter ? 0.4 : 0.2, 0.3, 3400, 300);
          }
        }
      }
    }
    lastTimelineTime = position;
  }

  return {
    prepare(): Promise<void> {
      if (disposed || failed) return Promise.resolve();
      try {
        ensureGraph();
        if (ctx && ctx.state !== 'running') {
          return ctx.resume().then(() => {}).catch(unavailable);
        }
        return Promise.resolve();
      } catch {
        unavailable();
        return Promise.resolve();
      }
    },
    play(time: number) {
      if (disposed || failed) return;
      ensureGraph();
      position = clampTime(time);
      playing = position < DURATION;
      if (!playing) { stopChordVoices(); return; }
      if (ctx?.state === 'suspended') void ctx.resume();
      if (gate && ctx) {
        gate.gain.cancelScheduledValues(ctx.currentTime);
        gate.gain.setValueAtTime(1, ctx.currentTime);
      }
      lastTimelineTime = position - 0.01;
      lastRhythmStep = -1;
      sync(position);
    },
    pause() {
      playing = false;
      stopChordVoices();
      if (gate && ctx) {
        gate.gain.cancelScheduledValues(ctx.currentTime);
        gate.gain.setValueAtTime(0, ctx.currentTime);
      }
    },
    seek(time: number) {
      position = clampTime(time);
      lastTimelineTime = position - 0.01;
      lastRhythmStep = -1;
      stopChordVoices();
      if (playing) sync(position);
    },
    sync,
    setMuted(value: boolean) {
      muted = value;
      if (output) ramp(output.gain, muted ? 0 : 0.55);
    },
    dispose() {
      disposed = true;
      playing = false;
      stopChordVoices();
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
      output?.disconnect();
      ctx = null;
    },
  };
}
