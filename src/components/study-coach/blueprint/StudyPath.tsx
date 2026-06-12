import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { StudyTaskData } from "@/components/study-coach/TaskCard";
import { Book, BookOpen, Calculator, Atom, Globe, Music as MusicIcon, Pen, Check, Play, Lock, Sparkles } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const iconMap: Record<string, any> = {
  book: Book, "book-open": BookOpen, calculator: Calculator, atom: Atom, flask: Atom, globe: Globe, music: MusicIcon, pen: Pen,
};

const diffRing: Record<string, string> = {
  easy: "ring-emerald-400/60",
  medium: "ring-amber-400/70",
  hard: "ring-rose-500/80",
};

interface Props {
  tasks: StudyTaskData[];
  onStart: (id: string) => void;
  onMarkDone?: (id: string) => void;
  onSkip?: (id: string) => void;
}

export function StudyPath({ tasks, onStart, onMarkDone, onSkip }: Props) {
  const [openTask, setOpenTask] = useState<StudyTaskData | null>(null);

  // Build node layout: 6 nodes/row, zig-zag horizontally
  const NODE_SIZE = 64;
  const ROW_H = 110;
  const COL_W = 84;
  const COLS = 5;

  const positioned = useMemo(() => {
    return tasks.map((t, i) => {
      const row = Math.floor(i / COLS);
      const colInRow = i % COLS;
      const leftToRight = row % 2 === 0;
      const col = leftToRight ? colInRow : COLS - 1 - colInRow;
      const x = 40 + col * COL_W + (row % 2 ? 16 : 0);
      const y = 30 + row * ROW_H;
      return { t, x, y, i };
    });
  }, [tasks]);

  // Find active index = first non-completed
  const activeIdx = tasks.findIndex((t) => t.status !== "completed" && t.status !== "skipped");

  const totalHeight = positioned.length ? positioned[positioned.length - 1].y + NODE_SIZE + 40 : 200;

  return (
    <>
      <div className="relative w-full mx-auto" style={{ height: totalHeight, maxWidth: 480 }}>
        {/* Dotted path connectors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 480 ${totalHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {positioned.slice(0, -1).map((p, i) => {
            const n = positioned[i + 1];
            const c1x = p.x + NODE_SIZE / 2;
            const c1y = p.y + NODE_SIZE + 30;
            const c2x = n.x + NODE_SIZE / 2;
            const c2y = n.y - 30;
            const mx1 = p.x + NODE_SIZE / 2;
            const my1 = p.y + NODE_SIZE / 2;
            const mx2 = n.x + NODE_SIZE / 2;
            const my2 = n.y + NODE_SIZE / 2;
            return (
              <path
                key={i}
                d={`M ${mx1} ${my1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${mx2} ${my2}`}
                stroke="url(#pathGrad)"
                strokeWidth="3"
                strokeDasharray="6 8"
                fill="none"
              />
            );
          })}
        </svg>

        {positioned.map(({ t, x, y, i }) => {
          const Icon = iconMap[t.icon_name] || Book;
          const isDone = t.status === "completed";
          const isSkipped = t.status === "skipped";
          const isActive = i === activeIdx;
          const isLocked = !isDone && !isActive && !isSkipped;
          const ring = diffRing[t.difficulty] || diffRing.medium;
          return (
            <button
              key={t.id}
              onClick={() => { navigator.vibrate?.(10); setOpenTask(t); }}
              className={cn(
                "absolute flex flex-col items-center group transition-transform tap-effect active:scale-95",
                isActive && "z-20 animate-bounce-slow",
              )}
              style={{ left: x, top: y, width: NODE_SIZE }}
              aria-label={`${t.subject_name}: ${t.topic}`}
            >
              {isActive && (
                <span className="absolute -top-6 text-[10px] font-bold text-primary uppercase tracking-wide animate-pulse">START</span>
              )}
              <div
                className={cn(
                  "relative h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg transition-all ring-4",
                  ring,
                  isDone && "bg-primary",
                  isSkipped && "bg-muted opacity-50",
                  isActive && "bg-card ring-primary scale-110 shadow-primary/40",
                  isLocked && "bg-muted/60 grayscale",
                )}
                style={!isDone && !isSkipped && !isLocked ? { backgroundColor: `${t.color}22` } : undefined}
              >
                {isDone ? (
                  <Check className="h-7 w-7 text-primary-foreground" strokeWidth={3} />
                ) : isLocked ? (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Icon className="h-7 w-7" style={{ color: isActive ? t.color : t.color + "aa" }} />
                )}
              </div>
              <span className={cn(
                "mt-1 text-[10px] font-semibold text-center leading-tight max-w-[80px] truncate",
                isLocked ? "text-muted-foreground/60" : "text-foreground/80",
              )}>
                {t.duration_minutes}m
              </span>
            </button>
          );
        })}
      </div>

      {/* Task detail sheet */}
      <Sheet open={!!openTask} onOpenChange={(o) => !o && setOpenTask(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {openTask && (() => {
            const Icon = iconMap[openTask.icon_name] || Book;
            const isDone = openTask.status === "completed";
            const isLocked = positioned.findIndex(p => p.t.id === openTask.id) > activeIdx && !isDone;
            return (
              <div className="space-y-4 pt-2 pb-6 max-w-md mx-auto">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${openTask.color}22` }}>
                    <Icon className="h-7 w-7" style={{ color: openTask.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{openTask.subject_name}</div>
                    <div className="text-base font-bold text-foreground leading-tight">{openTask.topic}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{openTask.duration_minutes}m</span>
                      <span>·</span>
                      <span className="capitalize">{openTask.difficulty}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex gap-2 text-[12px] text-foreground/80">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    {isDone ? "Crushed it. Spaced repetition will reinforce this in 2-3 days."
                      : isLocked ? "Complete earlier nodes first — interleaving keeps your brain warm."
                      : "Tap Start to launch a focused block. Your XP and streak will update on completion."}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { onSkip?.(openTask.id); setOpenTask(null); }}
                    disabled={isDone}
                    className="py-3 rounded-xl bg-muted text-foreground text-xs font-semibold tap-effect disabled:opacity-40"
                  >Skip</button>
                  <button
                    onClick={() => { onMarkDone?.(openTask.id); setOpenTask(null); }}
                    disabled={isDone}
                    className="py-3 rounded-xl bg-card border border-border text-foreground text-xs font-semibold tap-effect disabled:opacity-40"
                  >Mark done</button>
                  <button
                    onClick={() => { onStart(openTask.id); setOpenTask(null); }}
                    disabled={isDone || isLocked}
                    className="py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold tap-effect inline-flex items-center justify-center gap-1 shadow disabled:opacity-40"
                  >
                    <Play className="h-3 w-3 fill-current" /> Start
                  </button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}