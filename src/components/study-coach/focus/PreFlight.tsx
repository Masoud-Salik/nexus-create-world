import { useEffect, useState } from "react";
import { Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOUNDSCAPES, SoundscapeId } from "@/hooks/useSoundscape";
import { suggestDuration, Suggestion } from "@/utils/adaptiveDuration";

export type Energy = "low" | "mid" | "high";

interface Props {
  userId: string | null;
  defaultMinutes: number;
  defaultSoundscape: SoundscapeId;
  onLaunch: (config: { intent: string; energy: Energy; minutes: number; soundscape: SoundscapeId; breathing: boolean }) => void;
}

const ENERGIES: { id: Energy; emoji: string; label: string }[] = [
  { id: "low", emoji: "🥱", label: "Low" },
  { id: "mid", emoji: "🙂", label: "Steady" },
  { id: "high", emoji: "🔥", label: "Peak" },
];

const DURATIONS = [20, 25, 45, 60, 90];

export function PreFlight({ userId, defaultMinutes, defaultSoundscape, onLaunch }: Props) {
  const [intent, setIntent] = useState<string>(() => localStorage.getItem("focus.lastIntent") || "");
  const [energy, setEnergy] = useState<Energy>("mid");
  const [minutes, setMinutes] = useState<number>(defaultMinutes);
  const [soundscape, setSoundscape] = useState<SoundscapeId>(defaultSoundscape);
  const [breathing, setBreathing] = useState<boolean>(true);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    suggestDuration(userId, energy).then((s) => { if (!cancelled) setSuggestion(s); });
    return () => { cancelled = true; };
  }, [userId, energy]);

  const launch = () => {
    localStorage.setItem("focus.lastIntent", intent.trim());
    navigator.vibrate?.(10);
    onLaunch({ intent: intent.trim() || "Deep work", energy, minutes, soundscape, breathing });
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in space-y-4 px-2">
      {/* Intent */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Target className="h-3 w-3" /> Intent
        </label>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value.slice(0, 80))}
          placeholder="What are you focusing on?"
          className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:border-primary outline-none text-sm font-medium transition-colors"
        />
      </div>

      {/* Energy */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Energy</label>
        <div className="grid grid-cols-3 gap-2">
          {ENERGIES.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEnergy(e.id); navigator.vibrate?.(10); }}
              className={cn(
                "py-3 rounded-xl border text-sm font-semibold transition-all tap-effect",
                energy === e.id
                  ? "bg-primary/10 border-primary text-foreground shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <div className="text-xl">{e.emoji}</div>
              <div className="text-[11px] mt-0.5">{e.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration with suggestion */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</label>
          {suggestion && suggestion.minutes !== minutes && (
            <button
              onClick={() => { setMinutes(suggestion.minutes); navigator.vibrate?.(10); }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
              title={suggestion.reason}
            >
              <Sparkles className="h-3 w-3" /> Suggested {suggestion.minutes}m
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setMinutes(d); navigator.vibrate?.(10); }}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all tap-effect",
                minutes === d
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
              )}
            >
              {d}m
            </button>
          ))}
        </div>
        {suggestion && (
          <p className="text-[10px] text-muted-foreground italic">{suggestion.reason}</p>
        )}
      </div>

      {/* Soundscape */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Soundscape</label>
        <div className="grid grid-cols-4 gap-2">
          {SOUNDSCAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSoundscape(s.id); navigator.vibrate?.(10); }}
              className={cn(
                "py-2.5 rounded-xl border text-[10px] font-semibold transition-all tap-effect",
                soundscape === s.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              )}
              title={s.description}
            >
              <div className="text-base">{s.emoji}</div>
              <div className="mt-0.5 truncate">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Breathing toggle */}
      <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border cursor-pointer">
        <div>
          <div className="text-sm font-semibold">60s breathing primer</div>
          <div className="text-[11px] text-muted-foreground">Box-breath ritual before the session starts</div>
        </div>
        <input
          type="checkbox"
          checked={breathing}
          onChange={(e) => setBreathing(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>

      {/* Launch */}
      <button
        onClick={launch}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg tap-effect active:scale-[0.98] transition-all"
      >
        Begin Focus — {minutes}m
      </button>
    </div>
  );
}