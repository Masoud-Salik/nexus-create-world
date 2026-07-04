import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_study_stats",
  title: "Get study statistics",
  description: "Total minutes studied and session count over the last N days (default 7), broken down by subject.",
  inputSchema: {
    days: z.number().int().min(1).max(90).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const window = days ?? 7;
    const since = new Date(Date.now() - window * 86_400_000).toISOString().slice(0, 10);
    const client = sb(ctx);
    const [{ data: sessions, error: sErr }, { data: subjects }] = await Promise.all([
      client
        .from("study_sessions")
        .select("time_spent_minutes, subject_id, topic, session_date")
        .gte("session_date", since),
      client.from("study_subjects").select("id, subject_name"),
    ]);
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
    const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.subject_name]));
    const bySubject: Record<string, number> = {};
    let totalMinutes = 0;
    for (const s of sessions ?? []) {
      totalMinutes += s.time_spent_minutes ?? 0;
      const name = s.subject_id ? subjectMap.get(s.subject_id) ?? "Unassigned" : "Unassigned";
      bySubject[name] = (bySubject[name] ?? 0) + (s.time_spent_minutes ?? 0);
    }
    const summary = {
      window_days: window,
      total_minutes: totalMinutes,
      session_count: sessions?.length ?? 0,
      minutes_by_subject: bySubject,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});