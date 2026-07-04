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
  name: "create_task",
  title: "Create study task",
  description: "Create a new study task on the user's plan.",
  inputSchema: {
    topic: z.string().trim().min(1).max(200).describe("What to study."),
    subject_id: z.string().uuid().optional().describe("Related study_subjects.id."),
    task_date: z.string().optional().describe("YYYY-MM-DD; defaults to today."),
    duration_minutes: z.number().int().min(5).max(600).optional().describe("Planned duration (default 25)."),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await sb(ctx)
      .from("study_tasks")
      .insert({
        user_id: ctx.getUserId(),
        topic: input.topic,
        subject_id: input.subject_id ?? null,
        task_date: input.task_date ?? new Date().toISOString().slice(0, 10),
        duration_minutes: input.duration_minutes ?? 25,
        difficulty: input.difficulty ?? "medium",
        status: "pending",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created task ${data.id}: ${data.topic}` }],
      structuredContent: { task: data },
    };
  },
});