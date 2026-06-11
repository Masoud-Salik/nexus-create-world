import { useCallback, useEffect, useRef, useState } from "react";

export type SoundscapeId = "silence" | "brown" | "rain" | "binaural";

export interface SoundscapeTrack {
  id: SoundscapeId;
  label: string;
  emoji: string;
  description: string;
}

export const SOUNDSCAPES: SoundscapeTrack[] = [
  { id: "silence", label: "Silence", emoji: "🤫", description: "No background sound" },
  { id: "brown", label: "Brown Noise", emoji: "🌫", description: "Deep, warm masking noise — best for reading" },
  { id: "rain", label: "Rain", emoji: "🌧", description: "Soft rainfall — calming, low arousal" },
  { id: "binaural", label: "Binaural 14Hz", emoji: "🧠", description: "Beta-band binaural beat — sustained focus" },
];

const STORAGE_KEY = "studytime.soundscape.v1";

interface PersistedState {
  active: SoundscapeId;
  volume: number;
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {}
  return { active: "silence", volume: 0.45 };
}

/**
 * Procedural soundscape engine. No audio assets — fully generated with Web Audio.
 * - brown: integrated white noise → low-rumble noise
 * - rain: filtered white noise with gentle modulation
 * - binaural: two detuned sines (220Hz + 234Hz = 14Hz beat) — requires headphones
 */
export function useSoundscape() {
  const [active, setActive] = useState<SoundscapeId>(() => loadPersisted().active);
  const [volume, setVolumeState] = useState<number>(() => loadPersisted().volume);
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<{ stop: () => void } | null>(null);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ active, volume }));
    } catch {}
  }, [active, volume]);

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctxRef.current = new Ctx();
      const master = ctxRef.current.createGain();
      master.gain.value = volume;
      master.connect(ctxRef.current.destination);
      masterRef.current = master;
    }
    return ctxRef.current!;
  }, [volume]);

  const stopCurrent = useCallback(() => {
    if (nodesRef.current) {
      try { nodesRef.current.stop(); } catch {}
      nodesRef.current = null;
    }
    setPlaying(false);
  }, []);

  const buildBrown = useCallback((ctx: AudioContext, out: GainNode) => {
    const bufferSize = 4096;
    const node = ctx.createScriptProcessor(bufferSize, 1, 1);
    let lastOut = 0;
    node.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        output[i] = lastOut * 3.5;
      }
    };
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    node.connect(gain).connect(out);
    return { stop: () => { node.disconnect(); gain.disconnect(); } };
  }, []);

  const buildRain = useCallback((ctx: AudioContext, out: GainNode) => {
    const bufferSize = 4096;
    const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
    noise.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    };
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    // gentle LFO for rain swells
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    noise.connect(bp).connect(lp).connect(gain).connect(out);
    return {
      stop: () => {
        try { lfo.stop(); } catch {}
        noise.disconnect(); bp.disconnect(); lp.disconnect(); gain.disconnect();
      },
    };
  }, []);

  const buildBinaural = useCallback((ctx: AudioContext, out: GainNode) => {
    // Stereo split for true binaural beat
    const merger = ctx.createChannelMerger(2);
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    left.type = "sine"; right.type = "sine";
    left.frequency.value = 220;
    right.frequency.value = 234; // 14 Hz beat (beta)
    const lGain = ctx.createGain(); lGain.gain.value = 0.18;
    const rGain = ctx.createGain(); rGain.gain.value = 0.18;
    left.connect(lGain).connect(merger, 0, 0);
    right.connect(rGain).connect(merger, 0, 1);
    merger.connect(out);
    left.start(); right.start();
    return {
      stop: () => {
        try { left.stop(); } catch {}
        try { right.stop(); } catch {}
        lGain.disconnect(); rGain.disconnect(); merger.disconnect();
      },
    };
  }, []);

  const start = useCallback((id: SoundscapeId) => {
    setActive(id);
    stopCurrent();
    if (id === "silence") return;
    const ctx = ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    const master = masterRef.current!;
    let nodes;
    if (id === "brown") nodes = buildBrown(ctx, master);
    else if (id === "rain") nodes = buildRain(ctx, master);
    else nodes = buildBinaural(ctx, master);
    nodesRef.current = nodes;
    setPlaying(true);
  }, [ensureCtx, stopCurrent, buildBrown, buildRain, buildBinaural]);

  const stop = useCallback(() => { stopCurrent(); setActive("silence"); }, [stopCurrent]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (masterRef.current) masterRef.current.gain.value = clamped;
  }, []);

  const duck = useCallback((targetRatio: number) => {
    if (!masterRef.current) return;
    masterRef.current.gain.value = volume * targetRatio;
  }, [volume]);

  const restore = useCallback(() => {
    if (!masterRef.current) return;
    masterRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => () => {
    stopCurrent();
    try { ctxRef.current?.close(); } catch {}
  }, [stopCurrent]);

  return { active, volume, playing, start, stop, setVolume, duck, restore };
}