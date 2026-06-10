import { Flame, Zap, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { levelFromXp } from "@/utils/xp";

interface LifeProgressProps {
  todayCompletedXp: number;
  todayTotalXp: number;
  totalLifetimeXp: number;
  completedCount: number;
  totalCount: number;
  pendingMinutes: number;
  streak: number;
  weeklyMinutes: number[]; // length 7, Mon..Sun or last 7 days oldest→today
  weeklyGoalMinutes: number;
}

export function LifeProgress({
  todayCompletedXp,
  todayTotalXp,
  totalLifetimeXp,
  completedCount,
  totalCount,
  pendingMinutes,
  streak,
  weeklyMinutes,
  weeklyGoalMinutes,
}: LifeProgressProps) {
  const { level, xpInLevel, xpForNext } = levelFromXp(totalLifetimeXp);
  const levelPct = Math.min(100, (xpInLevel / Math.max(1, xpForNext)) * 100);
  const todayPct = totalTo100(todayCompletedXp, todayTotalXp);
  const weeklyTotal = weeklyMinutes.reduce((a, b) => a + b, 0);
  const weeklyPct = Math.min(100, (weeklyTotal / Math.max(1, weeklyGoalMinutes)) * 100);
  const maxDay = Math.max(60, ...weeklyMinutes);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-3 shadow-sm space-y-3">
      {/* Row 1: Level + XP */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="text-[11px] font-black text-primary-foreground">{level}</span>
              </div>
            </div>
            <span className="text-xs font-bold text-foreground">Level {level}</span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-[10px] font-bold">
                <Flame className="h-3 w-3" /> {streak}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {xpInLevel} / {xpForNext} XP
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary transition-all duration-700 ease-out"
            style={{ width: `${levelPct}%`, boxShadow: levelPct > 0 ? "0 0 8px hsl(var(--primary) / 0.5)" : undefined }}
          />
        </div>
      </div>

      {/* Row 2: Today's quests */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Today's Quests</span>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {pendingMinutes}m left
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.max(totalCount, 1) }).map((_, i) => {
            const done = i < completedCount;
            return (
              <div
                key={i}
                className={cn(
                  "h-2.5 flex-1 rounded-full transition-all duration-300",
                  done ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" : "bg-muted"
                )}
              />
            );
          })}
          <span className="ml-1 text-[11px] font-bold text-foreground tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>
        {todayTotalXp > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-mono tabular-nums">
              +{todayCompletedXp} / {todayTotalXp} XP today ({todayPct}%)
            </span>
          </div>
        )}
      </div>

      {/* Row 3: Weekly heat strip */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">This Week</span>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" /> {Math.round(weeklyPct)}% of goal
          </span>
        </div>
        <div className="flex items-end gap-1 h-8">
          {weeklyMinutes.map((m, i) => {
            const isToday = i === weeklyMinutes.length - 1;
            const h = Math.max(8, (m / maxDay) * 100);
            const intensity = m / maxDay;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={cn(
                    "w-full rounded-md transition-all duration-500",
                    isToday ? "ring-1 ring-primary" : ""
                  )}
                  style={{
                    height: `${h}%`,
                    background:
                      m === 0
                        ? "hsl(var(--muted))"
                        : `hsl(var(--primary) / ${0.35 + intensity * 0.6})`,
                  }}
                  title={`${m}m`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground/70">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function totalTo100(a: number, b: number) {
  if (b <= 0) return 0;
  return Math.round((a / b) * 100);
}