import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

const MUSIC_SRC = "/audio/study-music.mp3";
const LS_VOLUME = "studytime-music-volume";
const LS_PLAYING = "studytime-music-playing";

type Ctx = {
  playing: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
  pause: () => void;
  resume: () => void;
};

const GlobalMusicContext = createContext<Ctx | null>(null);

export function useGlobalMusic() {
  const c = useContext(GlobalMusicContext);
  if (!c) throw new Error("useGlobalMusic must be used inside GlobalMusicProvider");
  return c;
}

export function GlobalMusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolumeState] = useState<number>(() => {
    const v = localStorage.getItem(LS_VOLUME);
    return v ? parseFloat(v) : 0.3;
  });
  const [playing, setPlaying] = useState<boolean>(false);

  // Initialize audio once
  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;
    audio.addEventListener("ended", () => setPlaying(false));
    // Auto-resume if it was playing before refresh (best effort — needs user interaction)
    if (localStorage.getItem(LS_PLAYING) === "1") {
      audio.play().then(() => setPlaying(true)).catch(() => {/* needs gesture */});
    }
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(LS_VOLUME, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(LS_PLAYING, playing ? "1" : "0");
  }, [playing]);

  const toggle = useCallback(() => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  }, [playing]);

  const pause = useCallback(() => { audioRef.current?.pause(); setPlaying(false); }, []);
  const resume = useCallback(() => { audioRef.current?.play().then(() => setPlaying(true)).catch(() => {}); }, []);
  const setVolume = useCallback((v: number) => setVolumeState(v), []);

  // Expose for timer alarm integration
  useEffect(() => {
    (window as any).__studyMusicPause = pause;
    (window as any).__studyMusicResume = resume;
    return () => {
      delete (window as any).__studyMusicPause;
      delete (window as any).__studyMusicResume;
    };
  }, [pause, resume]);

  return (
    <GlobalMusicContext.Provider value={{ playing, volume, toggle, setVolume, pause, resume }}>
      {children}
    </GlobalMusicContext.Provider>
  );
}