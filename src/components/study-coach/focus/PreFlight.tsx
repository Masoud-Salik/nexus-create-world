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
    <div className="w-full max-w-md mx-auto animate-fade-in space-y-3 px-1">
      {/* Card 1 — Intent + Energy */}
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-3 space-y-2.5">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <Target className="h-3 w-3" /> Intent
          </label>
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value.slice(0, 80))}
            placeholder="What are you focusing on?"
            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-sm font-medium transition-colors"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {ENERGIES.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEnergy(e.id); navigator.vibrate?.(10); }}
              className={cn(
                "py-2 rounded-lg border text-xs font-semibold transition-all tap-effect flex items-center justify-center gap-1.5",
                energy === e.id
                  ? "bg-primary/10 border-primary text-foreground shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-base leading-none">{e.emoji}</span>
              <span className="text-[11px]">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card 2 — Duration + Soundscape */}
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Duration</label>
          {suggestion && suggestion.minutes !== minutes && (
            <button
              onClick={() => { setMinutes(suggestion.minutes); navigator.vibrate?.(10); }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
              title={suggestion.reason}
            >
              <Sparkles className="h-2.5 w-2.5" /> {suggestion.minutes}m
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setMinutes(d); navigator.vibrate?.(10); }}
              className={cn(
                "snap-start shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all tap-effect",
                minutes === d
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-background text-muted-foreground border-border/60 hover:border-primary/40"
              )}
            >
              {d}m
            </button>
          ))}
        </div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Soundscape</label>
        <div className="grid grid-cols-4 gap-1.5">
          {SOUNDSCAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSoundscape(s.id); navigator.vibrate?.(10); }}
              className={cn(
                "py-2 rounded-lg border text-[10px] font-semibold transition-all tap-effect",
                soundscape === s.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40"
              )}
              title={s.description}
            >
              <div className="text-sm leading-none">{s.emoji}</div>
              <div className="mt-0.5 truncate">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Inline breathing toggle + Launch */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border cursor-pointer text-[11px] font-semibold shrink-0">
          <input
            type="checkbox"
            checked={breathing}
            onChange={(e) => setBreathing(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          60s breath
        </label>
        <button
          onClick={launch}
          className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg tap-effect active:scale-[0.98] transition-all"
        >
          Begin Focus — {minutes}m
        </button>
      </div>
    </div>
  );
}