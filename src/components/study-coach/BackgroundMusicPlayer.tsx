import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Music, Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MUSIC_SRC = "/audio/study-music.mp3";
const LS_KEY = "studytime-music-volume";

export function BackgroundMusicPlayer({ compact = true }: { compact?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? parseFloat(saved) : 0.3;
  });

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener("ended", () => setPlaying(false));
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      localStorage.setItem(LS_KEY, String(volume));
    }
  }, [volume]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  // Expose pause/resume for timer alarm integration
  useEffect(() => {
    (window as any).__studyMusicPause = () => { audioRef.current?.pause(); setPlaying(false); };
    (window as any).__studyMusicResume = () => { audioRef.current?.play().catch(() => {}); setPlaying(true); };
    return () => {
      delete (window as any).__studyMusicPause;
      delete (window as any).__studyMusicResume;
    };
  }, []);

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        className={cn(
          "gap-1.5 transition-colors",
          playing && "border-primary/40 bg-primary/10 text-primary"
        )}
      >
        <Music className="h-4 w-4" />
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <Button
        variant={playing ? "default" : "outline"}
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={toggle}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">Study Music</p>
        <p className="text-[10px] text-muted-foreground">Lo-fi • Ghibli</p>
      </div>
      <div className="flex items-center gap-2 w-24">
        <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <Slider
          value={[volume * 100]}
          onValueChange={([v]) => setVolume(v / 100)}
          max={100}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
}
