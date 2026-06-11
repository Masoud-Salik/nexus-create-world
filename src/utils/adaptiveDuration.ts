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
      .select("duration_minutes, actual_minutes, completed_at")
      .eq("user_id", userId)
      .gte("completed_at", since)
      .limit(60);
    if (error || !data || data.length === 0) {
      return { minutes: snap(base), reason: energyReason(energy, hour), confidence: 0.55 };
    }
    const ratios = data
      .filter((r: any) => r.duration_minutes > 0)
      .map((r: any) => Math.min(1, (r.actual_minutes ?? r.duration_minutes) / r.duration_minutes));
    const avg = ratios.reduce((s, n) => s + n, 0) / Math.max(1, ratios.length);
    let adjusted = base;
    if (avg >= 0.9) adjusted = Math.min(90, base + 10);
    else if (avg < 0.6) adjusted = Math.max(20, base - 15);
    return {
      minutes: snap(adjusted),
      reason: `${Math.round(avg * 100)}% recent completion · ${energyReason(energy, hour)}`,
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