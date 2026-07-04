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
  name: "list_tasks",
  title: "List study tasks",
  description: "List the signed-in user's study tasks, optionally filtered by status or date.",
  inputSchema: {
    status: z.enum(["pending", "in_progress", "completed"]).optional().describe("Filter by status."),
    date: z.string().optional().describe("YYYY-MM-DD; filter to this task_date."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = sb(ctx)
      .from("study_tasks")
      .select("id, topic, subject_id, task_date, status, difficulty, duration_minutes, started_at, completed_at")
      .order("task_date", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    if (date) q = q.eq("task_date", date);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});