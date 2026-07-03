import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface Props {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  goalProgress?: number; // 0..1 - daily goal
  pulse?: boolean;
  intent?: string;
  timeText: string;
  finishText?: string;
  distractions?: number;
  variant?: "focus" | "break";
  children?: React.ReactNode;
}

export function FocusRing({
  size = 300,
  stroke = 16,
  progress,
  goalProgress = 0,
  pulse = false,
  intent,
  timeText,
  finishText,
  distractions = 0,
  variant = "focus",
  children,
}: Props) {
  // Responsive: clamp to viewport width on mobile so the ring never overflows.
  const [effectiveSize, setEffectiveSize] = useState(size);
  useEffect(() => {
    const compute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : size;
      // leave 32px of horizontal breathing room on each side
      const max = Math.max(200, Math.min(size, vw - 48));
      setEffectiveSize(max);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [size]);
  const s = effectiveSize;
  const effStroke = s < 260 ? 12 : stroke;
  const r1 = (s - effStroke) / 2;
  const r2 = r1 - effStroke - 4;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const off1 = c1 - Math.min(1, progress) * c1;
  const off2 = c2 - Math.min(1, goalProgress) * c2;
  const showGlow = progress >= 0.7;
  const dim = distractions > 0 ? Math.max(0.4, 1 - distractions * 0.08) : 1;

  return (
    <div className="relative flex items-center justify-center select-none max-w-full" style={{ width: s, height: s }}>
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="fr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor={variant === "break" ? "hsl(199 89% 58%)" : "hsl(170 70% 45%)"} />
          </linearGradient>
        </defs>
      </svg>
      <svg
        width={s}
        height={s}
        className="transform -rotate-90 motion-reduce:transition-none"
        style={{
          opacity: dim,
          filter: showGlow ? "drop-shadow(0 0 28px hsl(var(--primary) / 0.45))" : undefined,
        }}
      >
        {/* outer track */}
        <circle cx={s / 2} cy={s / 2} r={r1} fill="none" stroke="hsl(var(--muted))" strokeWidth={effStroke} opacity={0.3} />
        {/* outer progress */}
        <circle
          cx={s / 2} cy={s / 2} r={r1} fill="none"
          stroke="url(#fr-grad)" strokeWidth={effStroke} strokeLinecap="round"
          strokeDasharray={c1} strokeDashoffset={off1}
          className="transition-all duration-1000 ease-linear"
        />
        {/* inner goal track */}
        <circle cx={s / 2} cy={s / 2} r={r2} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} opacity={0.35} />
        {/* inner goal */}
        <circle
          cx={s / 2} cy={s / 2} r={r2} fill="none"
          stroke="hsl(var(--primary) / 0.6)" strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c2} strokeDashoffset={off2}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
        {intent && (
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary/80 line-clamp-1 max-w-full">
            {intent}
          </div>
        )}
        <div className={cn(
          "font-mono font-bold tabular-nums tracking-tight text-foreground",
          pulse && "animate-pulse text-destructive"
        )} style={{ fontSize: "2.5rem", lineHeight: 1 }}>
          {timeText}
        </div>
        {finishText && (
          <div className="text-[10px] text-muted-foreground">finishes {finishText}</div>
        )}
        {distractions > 0 && (
          <div className="text-[10px] font-semibold text-orange-500">
            ⚠ {distractions} {distractions === 1 ? "distraction" : "distractions"}
          </div>
        )}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}