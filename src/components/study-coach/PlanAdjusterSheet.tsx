import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, Clock } from "lucide-react";
import { StudyTaskData } from "@/components/study-coach/TaskCard";

export type AdjustMode =
  | "less_time"
  | "tired"
  | "push_harder"
  | "quick_review"
  | "swap_subject"
  | "evening";

const MODES: { mode: AdjustMode; emoji: string; title: string; desc: string }[] = [
  { mode: "less_time", emoji: "⏰", title: "Less time", desc: "Shorter sessions" },
  { mode: "tired", emoji: "😴", title: "I'm tired", desc: "Lower difficulty + shorter" },
  { mode: "push_harder", emoji: "🔥", title: "Push harder", desc: "More challenge, longer" },
  { mode: "quick_review", emoji: "⚡", title: "Quick review", desc: "Fast recap of weak spots" },
  { mode: "swap_subject", emoji: "🔀", title: "Mix it up", desc: "Reorder & interleave subjects" },
  { mode: "evening", emoji: "🌙", title: "Evening mode", desc: "Lighter cognitive load" },
];

export interface ProposedTask {
  id: string;
  subject_name: string;
  topic: string;
  duration_minutes: number;
  difficulty: string;
}

interface PlanAdjusterSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentTasks: StudyTaskData[];
  onPreview: (mode: AdjustMode) => Promise<{ tasks: ProposedTask[]; rationale: string } | null>;
  onApply: (tasks: ProposedTask[]) => Promise<void>;
}

export function PlanAdjusterSheet({
  open,
  onOpenChange,
  currentTasks,
  onPreview,
  onApply,
}: PlanAdjusterSheetProps) {
  const [mode, setMode] = useState<AdjustMode | null>(null);
  const [proposed, setProposed] = useState<ProposedTask[] | null>(null);
  const [rationale, setRationale] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setMode(null);
    setProposed(null);
    setRationale("");
  };

  const handleSelect = async (m: AdjustMode) => {
    setMode(m);
    setLoading(true);
    try {
      const res = await onPreview(m);
      if (res) {
        setProposed(res.tasks);
        setRationale(res.rationale);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!proposed) return;
    setApplying(true);
    try {
      await onApply(proposed);
      onOpenChange(false);
      reset();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {proposed ? "Preview adjusted plan" : "How are you feeling?"}
          </DialogTitle>
        </DialogHeader>

        {!proposed && !loading && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {MODES.map((m) => (
              <button
                key={m.mode}
                onClick={() => handleSelect(m.mode)}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-95 transition-all text-left"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs font-bold text-foreground">{m.title}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{m.desc}</span>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">NEXUS is re-planning your day…</p>
          </div>
        )}

        {proposed && !loading && (
          <div className="space-y-3 mt-2">
            {rationale && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-2.5 text-xs text-foreground">
                🧠 {rationale}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="font-bold text-muted-foreground mb-1.5">Before</p>
                <div className="space-y-1">
                  {currentTasks.map((t) => (
                    <div key={t.id} className="px-2 py-1.5 rounded-lg bg-muted">
                      <p className="font-semibold truncate">{t.subject_name}</p>
                      <p className="text-muted-foreground truncate">{t.topic}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {t.duration_minutes}m · {t.difficulty}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-primary mb-1.5 inline-flex items-center gap-1">
                  After <ArrowRight className="h-3 w-3" />
                </p>
                <div className="space-y-1">
                  {proposed.map((t) => (
                    <div
                      key={t.id}
                      className="px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/30"
                    >
                      <p className="font-semibold truncate">{t.subject_name}</p>
                      <p className="text-muted-foreground truncate">{t.topic}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {t.duration_minutes}m · {t.difficulty}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentTasks.reduce((s, t) => s + t.duration_minutes, 0)}m →{" "}
                {proposed.reduce((s, t) => s + t.duration_minutes, 0)}m
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleApply} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply plan"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}