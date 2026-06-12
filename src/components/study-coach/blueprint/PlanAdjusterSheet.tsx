import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Sparkles, Coffee, Flame, Shuffle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserFriendlyError } from "@/utils/errorUtils";

type Mode = "less_time" | "tired" | "push_harder" | "reshuffle";

interface Diff {
  id: string;
  topic: string;
  subject_name?: string;
  before: { duration_minutes: number; difficulty: string; topic?: string };
  after: { duration_minutes: number; difficulty: string; topic?: string };
}

const MODES: { id: Mode; emoji: any; title: string; desc: string }[] = [
  { id: "less_time", emoji: Clock, title: "Less time", desc: "Trim every task ~40%" },
  { id: "tired", emoji: Coffee, title: "I'm tired", desc: "Shorter + easier" },
  { id: "push_harder", emoji: Flame, title: "Push harder", desc: "Longer + harder" },
  { id: "reshuffle", emoji: Shuffle, title: "Reshuffle (AI)", desc: "Reorder by energy + weak spots" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApplied: () => void;
}

export function PlanAdjusterSheet({ open, onOpenChange, onApplied }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<Diff[] | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchPreview = async (m: Mode) => {
    setMode(m);
    setLoading(true);
    setDiffs(null);
    try {
      const { data, error } = await supabase.functions.invoke("study-coach", {
        body: { action: "adjust-plan-preview", mode: m },
      });
      if (error) throw error;
      setDiffs(data?.diffs || []);
    } catch (e) {
      toast({ title: "Couldn't preview", description: getUserFriendlyError(e), variant: "destructive" });
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!mode) return;
    setApplying(true);
    try {
      const { error } = await supabase.functions.invoke("study-coach", {
        body: { action: "adjust-plan", mode },
      });
      if (error) throw error;
      toast({ title: "Plan adjusted! ✨" });
      onApplied();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Couldn't apply", description: getUserFriendlyError(e), variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const reset = () => { setMode(null); setDiffs(null); };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
        <div className="max-w-md mx-auto space-y-4 pb-4">
          <div>
            <div className="text-lg font-bold text-foreground">Adjust today's plan</div>
            <p className="text-xs text-muted-foreground">Preview the change before it touches your blueprint.</p>
          </div>

          {!mode && (
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const Icon = m.emoji;
                return (
                  <button
                    key={m.id}
                    onClick={() => fetchPreview(m.id)}
                    className="text-left p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors tap-effect"
                  >
                    <Icon className="h-5 w-5 text-primary mb-1.5" />
                    <div className="font-bold text-sm text-foreground">{m.title}</div>
                    <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {mode && loading && (
            <div className="flex flex-col items-center py-10 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Computing the new plan...</span>
            </div>
          )}

          {mode && !loading && diffs && (
            <div className="space-y-3">
              <div className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">
                {diffs.length} task{diffs.length !== 1 && "s"} will change
              </div>
              {diffs.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  No pending tasks to adjust.
                </div>
              )}
              {diffs.map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] font-bold text-foreground truncate">{d.topic}</div>
                  {d.subject_name && <div className="text-[10px] text-muted-foreground">{d.subject_name}</div>}
                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground line-through">
                      {d.before.duration_minutes}m · {d.before.difficulty}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-semibold">
                      {d.after.duration_minutes}m · {d.after.difficulty}
                    </span>
                  </div>
                  {d.after.topic && d.before.topic && d.after.topic !== d.before.topic && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground italic">→ {d.after.topic}</div>
                  )}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={reset}
                  className="py-3 rounded-xl bg-muted text-foreground text-sm font-semibold tap-effect"
                >
                  Discard
                </button>
                <button
                  onClick={apply}
                  disabled={applying || diffs.length === 0}
                  className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold tap-effect inline-flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}