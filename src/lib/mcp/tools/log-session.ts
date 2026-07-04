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
  name: "log_study_session",
  title: "Log a completed study session",
  description: "Record a completed focus session (minutes spent on a topic).",
  inputSchema: {
    topic: z.string().trim().min(1).max(200),
    time_spent_minutes: z.number().int().min(1).max(600),
    subject_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    accuracy_score: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await sb(ctx)
      .from("study_sessions")
      .insert({
        user_id: ctx.getUserId(),
        topic: input.topic,
        time_spent_minutes: input.time_spent_minutes,
        subject_id: input.subject_id ?? null,
        task_id: input.task_id ?? null,
        accuracy_score: input.accuracy_score ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged ${data.time_spent_minutes}m on "${data.topic}"` }],
      structuredContent: { session: data },
    };
  },
});