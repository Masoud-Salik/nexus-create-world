import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { sb } from "./_client";

export default defineTool({
  name: "list_subjects",
  title: "List study subjects",
  description: "Return the signed-in user's study subjects with weekly targets.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await sb(ctx)
      .from("study_subjects")
      .select("id, subject_name, color, weekly_target_minutes, priority_order")
      .order("priority_order", { ascending: true, nullsFirst: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { subjects: data ?? [] },
    };
  },
});