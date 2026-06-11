import { supabase } from "@/integrations/supabase/client";

export interface Suggestion {
  minutes: number;
  reason: string;
  confidence: number;
}

export async function suggestDuration(
  userId: string | null,
  energy: "low" | "mid" | "high",
  hour: number = new Date().getHours(),
): Promise<Suggestion> {
  let base = energy === "low" ? 25 : energy === "high" ? 60 : 45;
  if (hour >= 6 && hour <= 10) base = Math.min(90, base + 10);
  else if (hour >= 13 && hour <= 14) base = Math.max(20, base - 10);
  else if (hour >= 22 || hour < 5) base = Math.min(base, 25);

  if (!userId) return { minutes: snap(base), reason: energyReason(energy, hour), confidence: 0.5 };

  try {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("study_sessions")
      .select("time_spent_minutes, session_date")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(60);
    if (error || !data || data.length === 0) {
      return { minutes: snap(base), reason: energyReason(energy, hour), confidence: 0.55 };
    }
    const lengths = data.map((r: any) => r.time_spent_minutes).filter((n: number) => n > 0);
    const avgLen = lengths.reduce((s: number, n: number) => s + n, 0) / Math.max(1, lengths.length);
    let adjusted = base;
    // If you typically sustain longer than base, lean up; if shorter, lean down
    if (avgLen >= base + 15) adjusted = Math.min(90, base + 10);
    else if (avgLen <= base - 15) adjusted = Math.max(20, base - 10);
    return {
      minutes: snap(adjusted),
      reason: `${Math.round(avgLen)}m avg recent · ${energyReason(energy, hour)}`,
      confidence: 0.75,
    };
  } catch {
    return { minutes: snap(base), reason: energyReason(energy, hour), confidence: 0.5 };
  }
}

function energyReason(energy: "low" | "mid" | "high", hour: number): string {
  const tod = hour < 12 ? "morning peak" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "late-night";
  const e = energy === "low" ? "low energy" : energy === "high" ? "high energy" : "steady energy";
  return `${e} · ${tod}`;
}

function snap(m: number): number {
  const steps = [20, 25, 30, 45, 60, 75, 90];
  return steps.reduce((best, s) => (Math.abs(s - m) < Math.abs(best - m) ? s : best), steps[0]);
}