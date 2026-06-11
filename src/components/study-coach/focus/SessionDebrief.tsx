import { useState } from "react";
import { Sparkles, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcFocusScore } from "@/utils/focusScore";

interface Props {
  elapsedSeconds: number;
  plannedSeconds: number;
  distractions: number;
  intent: string;
  onContinue: (rating: 1 | 2 | 3, note: string) => void;
  onBreak: () => void;
  onEnd: () => void;
}

export function SessionDebrief({
  elapsedSeconds, plannedSeconds, distractions, intent, onContinue, onBreak, onEnd,
}: Props) {
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [note, setNote] = useState("");
  const { score, xp, band } = calcFocusScore({
    elapsedSeconds, plannedSeconds, distractions, selfRating: rating ?? undefined,
  });

  const bandColor =
    band === "flow" ? "text-primary" :
    band === "good" ? "text-emerald-500" :
    band === "ok" ? "text-yellow-500" : "text-orange-500";

  return (
    <div className="w-full max-w-md mx-auto animate-slide-up-fade space-y-4 p-4 rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-md shadow-xl">
      <div className="text-center space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Session complete</div>
        <div className={cn("text-5xl font-mono font-bold", bandColor)}>{score}</div>
        <div className="text-xs text-muted-foreground capitalize">{band} · Focus Score</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 py-2">
          <div className="text-[9px] uppercase text-muted-foreground">Studied</div>
          <div className="font-bold text-sm">{Math.round(elapsedSeconds / 60)}m</div>
        </div>
        <div className="rounded-xl bg-primary/10 py-2">
          <div className="text-[9px] uppercase text-muted-foreground">XP</div>
          <div className="font-bold text-sm text-primary inline-flex items-center gap-0.5"><Zap className="h-3 w-3" />+{xp}</div>
        </div>
        <div className="rounded-xl bg-muted/50 py-2">
          <div className="text-[9px] uppercase text-muted-foreground">Distractions</div>
          <div className="font-bold text-sm">{distractions}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">How did it feel?</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 1 as const, e: "😵", l: "Distracted" },
            { v: 2 as const, e: "🙂", l: "OK" },
            { v: 3 as const, e: "🌊", l: "Flow" },
          ]).map((r) => (
            <button
              key={r.v}
              onClick={() => setRating(r.v)}
              className={cn(
                "py-2 rounded-xl border text-xs font-semibold transition-all tap-effect",
                rating === r.v
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:border-primary/40"
              )}
            >
              <div className="text-lg">{r.e}</div>
              <div className="text-[10px] mt-0.5">{r.l}</div>
            </button>
          ))}
        </div>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 120))}
        placeholder={intent ? `What did you accomplish on "${intent}"?` : "What did you accomplish?"}
        className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border focus:border-primary outline-none text-sm transition-colors"
      />

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onEnd}
          className="py-3 rounded-xl bg-muted text-foreground font-semibold text-xs tap-effect active:scale-95"
        >
          End day
        </button>
        <button
          onClick={onBreak}
          className="py-3 rounded-xl bg-card border border-border text-foreground font-semibold text-xs tap-effect active:scale-95"
        >
          Take break
        </button>
        <button
          onClick={() => onContinue(rating ?? 2, note)}
          className="py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow tap-effect active:scale-95 inline-flex items-center justify-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Next
        </button>
      </div>
    </div>
  );
}