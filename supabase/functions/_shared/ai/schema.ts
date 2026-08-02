/**
 * E3 / M3.1 — structured output validation.
 *
 * Model output is never trusted. Anything declaring an `outputSchema` is parsed
 * here; one repair round is allowed, after which the call fails with a typed
 * `schema_rejected`. Malformed AI output must never reach the database.
 */
import { z } from "npm:zod@3.23.8";

export { z };

export class SchemaRejected extends Error {
  readonly code = "schema_rejected";
  constructor(readonly schemaKey: string, readonly issues: string[], readonly retries: number) {
    super(`schema_rejected:${schemaKey}`);
    this.name = "SchemaRejected";
  }
}

export const extractMemorySchema = z.object({
  should_save: z.boolean(),
  category: z
    .enum([
      "like",
      "dislike",
      "preference",
      "habit",
      "goal",
      "personal_fact",
      "belief",
      "health",
      "skill",
    ])
    .nullable()
    .optional(),
  content: z.string().max(2000).nullable().optional(),
  sentiment: z.enum(["strong", "moderate", "mild"]).nullable().optional(),
});

export const studyPlanSchema = z.object({
  tasks: z.array(
    z.object({
      date: z.string(),
      subject_name: z.string(),
      topic: z.string(),
      duration_minutes: z.number(),
      difficulty: z.enum(["easy", "medium", "hard"]),
    }),
  ),
});

/**
 * The planner has always emitted a bare JSON array of tasks. Fields stay loose
 * because the edge function clamps and remaps them before writing.
 */
export const studyPlanTasksSchema = z.array(
  z.object({
    date: z.string().optional().nullable(),
    subject_name: z.string().optional().nullable(),
    topic: z.string().optional().nullable(),
    duration_minutes: z.number().optional().nullable(),
    difficulty: z.string().optional().nullable(),
  }),
).min(1);

export const futureScenariosSchema = z.object({
  scenarios: z.array(
    z.object({
      scenario_type: z.string(),
      title: z.string(),
      description: z.string(),
      skills_gained: z.array(z.string()).optional().nullable(),
      opportunities: z.array(z.string()).optional().nullable(),
      risks: z.array(z.string()).optional().nullable(),
      recommendations: z.array(z.string()).optional().nullable(),
      probability_score: z.number().optional().nullable(),
    }),
  ),
});

export const weeklyReportSchema = z.object({
  progress_trend: z.enum(["improving", "stable", "declining"]).optional().nullable(),
  summary: z.string().optional().nullable(),
  main_reason: z.string().optional().nullable(),
  action_items: z.array(z.string()).optional().nullable(),
  compared_to_high_performers: z.string().optional().nullable(),
});

export const dailyCoachSchema = z.object({
  priority_focus: z.string().optional().nullable(),
  warning_message: z.string().optional().nullable(),
  motivation_level: z.enum(["low", "medium", "high"]).optional().nullable(),
});

export const chatTitleSchema = z.object({ title: z.string().min(1).max(120) });

export const SCHEMAS: Record<string, z.ZodTypeAny> = {
  extract_memory: extractMemorySchema,
  study_plan: studyPlanSchema,
  study_plan_tasks: studyPlanTasksSchema,
  future_scenarios: futureScenariosSchema,
  weekly_report: weeklyReportSchema,
  daily_coach: dailyCoachSchema,
  chat_title: chatTitleSchema,
};

export function getSchema(key: string): z.ZodTypeAny {
  const schema = SCHEMAS[key];
  if (!schema) throw new Error(`unknown_schema:${key}`);
  return schema;
}

/** Pull the first JSON object/array out of a model response. */
export function extractJson(raw: string): unknown {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const candidates = [fenced];
  const objMatch = fenced.match(/[[{][\s\S]*[\]}]/);
  if (objMatch) candidates.push(objMatch[0]);
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export interface ValidateResult<T> {
  value: T;
  retries: number;
}

/**
 * Validate `raw` against the schema. On failure, `repair` is invoked exactly
 * once with the validation issues; if that output is still invalid we throw.
 */
export async function validateWithRepair<T>(
  schemaKey: string,
  raw: unknown,
  repair?: (issues: string[]) => Promise<unknown>,
): Promise<ValidateResult<T>> {
  const schema = getSchema(schemaKey);
  const normalize = (input: unknown) => (typeof input === "string" ? extractJson(input) : input);

  const first = schema.safeParse(normalize(raw));
  if (first.success) return { value: first.data as T, retries: 0 };

  const issues = first.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  if (!repair) throw new SchemaRejected(schemaKey, issues, 0);

  const repaired = await repair(issues);
  const second = schema.safeParse(normalize(repaired));
  if (second.success) return { value: second.data as T, retries: 1 };

  throw new SchemaRejected(
    schemaKey,
    second.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    1,
  );
}