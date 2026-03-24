import { useCallback, useRef } from "react";

const RINGTONES = [
  { id: "1", label: "Ringtone 1", src: "/ringtones/ringtone-1.mp3" },
  { id: "2", label: "Ringtone 2", src: "/ringtones/ringtone-2.mp3" },
  { id: "3", label: "Ringtone 3", src: "/ringtones/ringtone-3.mp3" },
  { id: "4", label: "Ringtone 4", src: "/ringtones/ringtone-4.mp3" },
  { id: "5", label: "Ringtone 5", src: "/ringtones/ringtone-5.mp3" },
];

const DEFAULT_RINGTONE = "3";

export function getSelectedRingtone(): string {
  return localStorage.getItem("selected_ringtone") || DEFAULT_RINGTONE;
}

export function setSelectedRingtone(id: string) {
  localStorage.setItem("selected_ringtone", id);
}

export function getRingtones() {
  return RINGTONES;
}

export function useTimerSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playRingtone = useCallback(() => {
    try {
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const selected = getSelectedRingtone();
      const ringtone = RINGTONES.find((r) => r.id === selected) || RINGTONES[2];
      
      const audio = new Audio(ringtone.src);
      audioRef.current = audio;
      audio.play().then(() => {
        // Vibrate AFTER audio starts playing — no pre-delay
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }).catch((e) => console.warn("Audio playback failed:", e));
    } catch (e) {
      console.warn("Audio playback failed:", e);
    }
  }, []);

  const previewRingtone = useCallback((id: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const ringtone = RINGTONES.find((r) => r.id === id);
      if (!ringtone) return;
      const audio = new Audio(ringtone.src);
      audioRef.current = audio;
      audio.play().catch((e) => console.warn("Audio preview failed:", e));
    } catch (e) {
      console.warn("Audio preview failed:", e);
    }
  }, []);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { playRingtone, previewRingtone, stopPreview };
}
