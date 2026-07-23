import { Flame, Zap, ShieldCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyProgress } from "@/hooks/useStudyProgress";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function LifeProgress({ progress, streak }: { progress: StudyProgress; streak: number }) {
  const xpPct = Math.min(100, Math.round((progress.xpInLevel / Math.max(1, progress.xpForLevel)) * 100));
  const goalPct = Math.min(100, Math.round((progress.todayMinutes / Math.max(1, progress.dailyGoalMinutes)) * 100));
  const peak = Math.max(1, ...progress.weekMinutesPerDay);

  // Today index = last column; align week labels so today is rightmost
  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon
  const labels = Array.from({ length: 7 }, (_, i) => {
    const idx = (todayDow + 1 + i) % 7;
    return DAY_LABELS[idx];
  });

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 space-y-2.5 shadow-sm">
      {/* Level + XP + streak */}
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-md shrink-0">
          <span className="text-sm font-black text-primary-foreground">{progress.level}</span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-px rounded-full bg-background border border-border text-foreground/70 uppercase tracking-wide">LVL</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            <span className="truncate">XP {progress.xpInLevel}/{progress.xpForLevel}</span>
            <span className="inline-flex items-center gap-1 text-foreground">
              <Zap className="h-3 w-3 text-primary" /> {progress.totalXp}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>Goal {progress.todayMinutes}/{progress.dailyGoalMinutes}m</span>
            <span className="font-semibold text-foreground">{goalPct}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
        <div className="flex flex-col items-center px-1.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 shrink-0">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-[11px] font-black text-orange-500 leading-none mt-0.5">{streak}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {progress.quests.map((q) => (
          <div
            key={q.id}
            className={cn(
              "flex-1 min-w-0 px-1.5 py-1 rounded-md border text-[10px] font-semibold flex items-center gap-1 transition-all",
              q.done
                ? "bg-primary/15 border-primary text-primary"
                : "bg-muted/40 border-border text-muted-foreground",
            )}
            title={q.label}
          >
            <span className={cn(
              "h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0",
              q.done ? "bg-primary text-primary-foreground" : "bg-muted border border-border",
            )}>
              {q.done && <Check className="h-2 w-2" strokeWidth={3} />}
            </span>
            <span className="truncate">{q.label}</span>
          </div>
        ))}
      </div>

      {/* Weekly heatmap — compact strip */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center justify-between">
          <span>7-day streak</span>
          <span className="inline-flex items-center gap-1 text-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            {progress.weekMinutesPerDay.reduce((a, b) => a + b, 0)}m
          </span>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {progress.weekMinutesPerDay.map((m, i) => {
            const intensity = m === 0 ? 0 : 0.25 + 0.75 * (m / peak);
            const isToday = i === 6;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "h-5 w-full rounded-sm border transition-all",
                    m === 0 ? "bg-muted/40 border-border" : "border-primary/40",
                    isToday && "ring-1 ring-primary",
                  )}
                  style={m > 0 ? { backgroundColor: `hsl(var(--primary) / ${intensity})` } : undefined}
                  title={`${m}m`}
                />
                <span className={cn("text-[8px] font-bold leading-none", isToday ? "text-primary" : "text-muted-foreground")}>
                  {labels[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}