import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";

interface DayCount { date: string; total: number; done: number; }

interface Props {
  selectedDate: string; // yyyy-MM-dd
  onSelect: (date: string) => void;
  perDay: DayCount[]; // any subset; missing dates default to 0/0
}

export function WeekRibbon({ selectedDate, onSelect, perDay }: Props) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const map = new Map(perDay.map((d) => [d.date, d]));

  return (
    <div className="flex gap-1.5 overflow-x-auto py-1 -mx-1 px-1 scrollbar-none">
      {days.map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const isToday = isSameDay(d, today);
        const isSelected = ds === selectedDate;
        const isFuture = d.getTime() > today.getTime() && !isToday;
        const info = map.get(ds);
        const total = info?.total ?? 0;
        const done = info?.done ?? 0;
        return (
          <button
            key={ds}
            onClick={() => { navigator.vibrate?.(10); onSelect(ds); }}
            className={cn(
              "flex-1 min-w-[44px] flex flex-col items-center py-2 rounded-xl border transition-all tap-effect",
              isSelected ? "bg-primary text-primary-foreground border-primary shadow"
                : isToday ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-card border-border text-muted-foreground",
              isFuture && !isSelected && "opacity-50",
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide">{format(d, "EEE")}</span>
            <span className={cn("text-base font-black leading-none mt-0.5", isSelected && "text-primary-foreground")}>{format(d, "d")}</span>
            <div className="flex gap-0.5 mt-1.5 h-1">
              {total === 0 ? (
                <span className={cn("h-1 w-1 rounded-full", isSelected ? "bg-primary-foreground/40" : "bg-muted-foreground/30")} />
              ) : Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-1 rounded-full",
                    i < done
                      ? (isSelected ? "bg-primary-foreground" : "bg-primary")
                      : (isSelected ? "bg-primary-foreground/30" : "bg-muted-foreground/30"),
                  )}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}