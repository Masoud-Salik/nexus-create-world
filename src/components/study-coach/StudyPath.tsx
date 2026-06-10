import { useState } from "react";
import { cn } from "@/lib/utils";
import { StudyTaskData } from "@/components/study-coach/TaskCard";
import { Play, Check, Lock, Clock, Sparkles, Zap, MessageCircle } from "lucide-react";
import { Book, Calculator, Atom, Globe, Music as MusicIcon, Pen } from "lucide-react";
import { taskXp } from "@/utils/xp";

const iconMap: Record<string, any> = {
  book: Book, "book-open": Book, calculator: Calculator, atom: Atom, flask: Atom, globe: Globe, music: MusicIcon, pen: Pen,
};

const difficultyConfig: Record<string, { emoji: string; label: string; tint: string }> = {
  easy: { emoji: "⚡", label: "Easy", tint: "text-emerald-500" },
  medium: { emoji: "💪", label: "Medium", tint: "text-yellow-500" },
  hard: { emoji: "🔥", label: "Hard", tint: "text-red-500" },
};

interface StudyPathProps {
  tasks: StudyTaskData[];
  onStart: (taskId: string) => void;
  onAskNexus?: (task: StudyTaskData) => void;
}

export function StudyPath({ tasks, onStart, onAskNexus }: StudyPathProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Determine "active" = first non-completed
  const activeIdx = tasks.findIndex((t) => t.status !== "completed");

  return (
    <div className="relative px-2 py-4">
      {/* SVG path connecting nodes */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="path-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative flex flex-col gap-3">
        {tasks.map((task, idx) => {
          const Icon = iconMap[task.icon_name] || Book;
          const diff = difficultyConfig[task.difficulty] || difficultyConfig.medium;
          const isDone = task.status === "completed";
          const isActive = idx === activeIdx;
          const isLocked = !isDone && !isActive;
          const xp = taskXp(task);
          const side: "left" | "right" = idx % 2 === 0 ? "left" : "right";
          const expanded = expandedId === task.id;

          return (
            <div key={task.id} className="relative">
              {/* Connector */}
              {idx > 0 && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gradient-to-b from-transparent to-border"
                  aria-hidden
                />
              )}

              <div
                className={cn(
                  "flex items-center gap-3",
                  side === "right" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Node */}
                <button
                  onClick={() => {
                    setExpandedId(expanded ? null : task.id);
                    navigator.vibrate?.(10);
                  }}
                  className={cn(
                    "relative shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95",
                    isDone &&
                      "bg-gradient-to-br from-emerald-400 to-primary text-primary-foreground shadow-lg shadow-primary/30",
                    isActive &&
                      "bg-card border-2 border-primary shadow-lg shadow-primary/40 ring-4 ring-primary/20 animate-[pulse-glow_2s_ease-in-out_infinite]",
                    isLocked && "bg-muted border-2 border-dashed border-border text-muted-foreground"
                  )}
                  style={
                    !isDone && !isLocked
                      ? undefined
                      : isLocked
                        ? { borderColor: `${task.color}40` }
                        : undefined
                  }
                  aria-label={`${task.subject_name}: ${task.topic}`}
                >
                  {isDone ? (
                    <Check className="h-7 w-7" strokeWidth={3} />
                  ) : (
                    <Icon
                      className="h-7 w-7"
                      style={{ color: isActive ? task.color : `${task.color}AA` }}
                    />
                  )}
                  {isActive && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider animate-bounce">
                      Start
                    </span>
                  )}
                  {isDone && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[9px] font-black">
                      +{xp}
                    </span>
                  )}
                </button>

                {/* Inline label */}
                <div className={cn("flex-1 min-w-0", side === "right" ? "text-right" : "text-left")}>
                  <p className={cn("text-sm font-bold truncate", isLocked && "text-muted-foreground")}>
                    {task.subject_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{task.topic}</p>
                  <div className={cn("flex items-center gap-2 mt-0.5", side === "right" && "justify-end")}>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" /> {task.duration_minutes}m
                    </span>
                    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", diff.tint)}>
                      {diff.emoji} {diff.label}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-bold">
                      <Zap className="h-2.5 w-2.5" /> {xp}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded action card */}
              {expanded && (
                <div className="mt-2 mx-auto max-w-sm rounded-2xl border border-primary/30 bg-card p-3 shadow-lg animate-fade-in">
                  <div className="flex items-start gap-2 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${task.color}20` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: task.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{task.topic}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.subject_name} · {task.duration_minutes} min · {diff.label}
                      </p>
                      {(task as any).science_reason && (
                        <p className="mt-1 text-[10px] text-primary/80 italic">
                          🧠 {(task as any).science_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isDone && (
                      <button
                        onClick={() => onStart(task.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Play className="h-4 w-4 fill-current" /> Start Quest
                      </button>
                    )}
                    {onAskNexus && (
                      <button
                        onClick={() => onAskNexus(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 active:scale-95 transition-all"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Ask
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Final trophy node */}
        <div className="relative mt-2 flex items-center justify-center">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gradient-to-b from-border to-yellow-400/50" />
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
              tasks.every((t) => t.status === "completed") && tasks.length > 0
                ? "bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-[0_0_24px_rgba(250,204,21,0.6)] animate-pulse"
                : "bg-muted border-2 border-dashed border-border"
            )}
          >
            {tasks.every((t) => t.status === "completed") && tasks.length > 0 ? (
              <Sparkles className="h-7 w-7 text-yellow-900" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}