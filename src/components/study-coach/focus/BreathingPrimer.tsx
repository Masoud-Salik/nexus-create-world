import { useEffect, useState } from "react";

interface Props {
  seconds?: number;
  onDone: () => void;
  onSkip: () => void;
}

/**
 * 60s box-breath: 4s inhale, 4s hold, 4s exhale, 4s hold. Loops ~3-4 cycles.
 */
export function BreathingPrimer({ seconds = 60, onDone, onSkip }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [phase, setPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); onDone(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onDone]);

  useEffect(() => {
    const tick = (seconds - remaining) % 16;
    if (tick < 4) setPhase("inhale");
    else if (tick < 8) setPhase("hold1");
    else if (tick < 12) setPhase("exhale");
    else setPhase("hold2");
  }, [remaining, seconds]);

  const scale =
    phase === "inhale" ? "scale-100" :
    phase === "exhale" ? "scale-50" :
    phase === "hold1" ? "scale-100" : "scale-50";

  const label =
    phase === "inhale" ? "Inhale" :
    phase === "exhale" ? "Exhale" :
    "Hold";

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full bg-primary/15 transition-transform duration-[4000ms] ease-in-out ${scale}`}
        />
        <div
          className={`absolute inset-6 rounded-full bg-primary/25 transition-transform duration-[4000ms] ease-in-out ${scale}`}
        />
        <div className="relative text-center">
          <div className="text-2xl font-bold text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-1">{remaining}s</div>
        </div>
      </div>
      <button
        onClick={onSkip}
        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
      >
        Skip primer
      </button>
    </div>
  );
}