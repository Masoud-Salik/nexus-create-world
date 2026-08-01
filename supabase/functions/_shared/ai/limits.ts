/**
 * E3 / M3.2 — per-owner AI rate windows.
 *
 * Fail closed: if we cannot establish how much an owner has already spent, the
 * request is denied. An unmetered AI endpoint is an unbounded bill.
 */
import { TaskName, getTask } from "./tasks.ts";

export interface WindowUsage {
  requests: number;
  /** False means "usage lookup failed" — the fail-closed signal. */
  known: boolean;
}

export interface LimitDecision {
  allowed: boolean;
  reason?: "rate_limited" | "usage_unknown";
  limit: number;
  used: number;
  windowSeconds: number;
}

export function evaluateWindow(task: TaskName, usage: WindowUsage): LimitDecision {
  const { windowLimit, windowSeconds } = getTask(task);
  if (!usage.known) {
    return { allowed: false, reason: "usage_unknown", limit: windowLimit, used: -1, windowSeconds };
  }
  return {
    allowed: usage.requests < windowLimit,
    reason: usage.requests < windowLimit ? undefined : "rate_limited",
    limit: windowLimit,
    used: usage.requests,
    windowSeconds,
  };
}

export type UsageCounter = (args: {
  ownerId: string;
  task: TaskName;
  since: string;
}) => Promise<number | null>;

/** Count this owner's calls for the task inside the window; null on failure. */
export function supabaseUsageCounter(supabase: { from: (t: string) => any }): UsageCounter {
  return async ({ ownerId, task, since }) => {
    try {
      const { count, error } = await supabase
        .from("ai_calls")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("task", task)
        .gte("created_at", since);
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  };
}

export async function checkLimit(
  counter: UsageCounter,
  ownerId: string,
  task: TaskName,
  now: Date = new Date(),
): Promise<LimitDecision> {
  const { windowSeconds } = getTask(task);
  const since = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const requests = await counter({ ownerId, task, since });
  return evaluateWindow(task, { requests: requests ?? 0, known: requests !== null });
}