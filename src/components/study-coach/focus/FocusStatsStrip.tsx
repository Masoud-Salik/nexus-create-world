import { Flame, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  streak: number;
  todayMinutes: number;
  goalMinutes: number;
  level: number;
  xpInLevel: number;
  xpForLevel: number;
  liveCount?: number;
}

export function FocusStatsStrip({
  streak, todayMinutes, goalMinutes, level, xpInLevel, xpForLevel, liveCount,
}: Props) {
  const goalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, goalMinutes)) * 100));
  const xpPct = Math.min(100, Math.round((xpInLevel / Math.max(1, xpForLevel)) * 100));
  return (
    <div className="w-full max-w-md mx-auto px-3 py-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <Flame className="h-3.5 w-3.5 text-orange-500" />
        <span>{streak}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{todayMinutes}m / {goalMinutes}m</span>
          <span>{goalPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${goalPct}%` }} />
        </div>
      </div>
      <div className="flex flex-col items-end min-w-[58px]">
        <div className="inline-flex items-center gap-1 font-semibold">
          <Trophy className="h-3 w-3 text-primary" /> Lv {level}
        </div>
        <div className={cn("w-12 h-1 rounded-full bg-muted overflow-hidden mt-0.5")}>
          <div className="h-full bg-primary/80" style={{ width: `${xpPct}%` }} />
        </div>
      </div>
      {typeof liveCount === "number" && liveCount > 0 && (
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground border-l border-border/60 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {liveCount} focusing
        </div>
      )}
    </div>
  );
}