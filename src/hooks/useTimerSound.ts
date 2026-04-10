import { useCallback, useRef } from "react";

const RINGTONES = [
  { id: "1", label: "Ringtone 1", src: "/ringtones/ringtone-1.mp3" },
  { id: "2", label: "Ringtone 2", src: "/ringtones/ringtone-2.mp3" },
  { id: "3", label: "Ringtone 3", src: "/ringtones/ringtone-3.mp3" },
];

const DEFAULT_RINGTONE = "1";
const FADE_DURATION = 1500; // ms
const MAX_REPLAYS = 3;

export function getSelectedRingtone(): string {
  const stored = localStorage.getItem("selected_ringtone");
  // Reset to default if stored value references a removed ringtone
  if (stored && RINGTONES.find((r) => r.id === stored)) return stored;
  return DEFAULT_RINGTONE;
}

export function setSelectedRingtone(id: string) {
  localStorage.setItem("selected_ringtone", id);
}

export function getRingtones() {
  return RINGTONES;
}

function fadeIn(audio: HTMLAudioElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    audio.volume = 0;
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(1, step / steps);
      if (step >= steps) {
        clearInterval(interval);
        resolve();
      }
    }, stepTime);
  });
}

function fadeOut(audio: HTMLAudioElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const startVol = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(interval);
        audio.pause();
        resolve();
      }
    }, stepTime);
  });
}

export function useTimerSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const replayCountRef = useRef(0);
  const isPlayingRef = useRef(false);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const stopPreview = useCallback(() => {
    isPlayingRef.current = false;
    replayCountRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const playRingtone = useCallback((onAllReplaysComplete?: () => void) => {
    try {
      stopPreview();
      isPlayingRef.current = true;
      replayCountRef.current = 0;
      onCompleteRef.current = onAllReplaysComplete || null;

      const selected = getSelectedRingtone();
      const ringtone = RINGTONES.find((r) => r.id === selected) || RINGTONES[0];

      const playOnce = () => {
        if (!isPlayingRef.current) return;

        const audio = new Audio(ringtone.src);
        audioRef.current = audio;

        audio.addEventListener("canplaythrough", () => {
          if (!isPlayingRef.current) return;
          audio.play().then(() => {
            fadeIn(audio, FADE_DURATION);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }).catch((e) => console.warn("Audio playback failed:", e));
        }, { once: true });

        audio.addEventListener("ended", () => {
          replayCountRef.current++;
          if (replayCountRef.current >= MAX_REPLAYS) {
            isPlayingRef.current = false;
            audioRef.current = null;
            onCompleteRef.current?.();
          } else {
            // Fade out is already done (song ended), start next replay
            playOnce();
          }
        }, { once: true });

        // Fade out before the song ends
        audio.addEventListener("timeupdate", () => {
          if (!isPlayingRef.current) return;
          const remaining = audio.duration - audio.currentTime;
          if (remaining > 0 && remaining <= FADE_DURATION / 1000 && audio.volume > 0.05) {
            fadeOut(audio, remaining * 1000);
          }
        });
      };

      playOnce();
    } catch (e) {
      console.warn("Audio playback failed:", e);
    }
  }, [stopPreview]);

  const previewRingtone = useCallback((id: string) => {
    try {
      stopPreview();
      const ringtone = RINGTONES.find((r) => r.id === id);
      if (!ringtone) return;
      const audio = new Audio(ringtone.src);
      audioRef.current = audio;
      audio.volume = 0;
      audio.play().then(() => fadeIn(audio, 800)).catch((e) => console.warn("Audio preview failed:", e));
      // Auto-stop after 8 seconds with fade
      setTimeout(() => {
        if (audioRef.current === audio) {
          fadeOut(audio, 800).then(() => {
            audioRef.current = null;
          });
        }
      }, 7000);
    } catch (e) {
      console.warn("Audio preview failed:", e);
    }
  }, [stopPreview]);

  return { playRingtone, previewRingtone, stopPreview };
}
