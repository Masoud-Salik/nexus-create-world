/**
 * E3 / M3.1 — the AI task registry.
 *
 * Every model call in StudyTime belongs to exactly one task. A task owns its
 * model chain, token ceiling, temperature and prompt key; no call site may pick
 * a model itself. Adding a task here is a deliberate governance decision.
 */

export type TaskName =
  | "chat"
  | "extract_memory"
  | "future_scenarios"
  | "future_weekly_report"
  | "future_daily_coach"
  | "study_coach"
  | "session_debrief"
  | "generate_chat_title"
  | "embeddings"
  | "doc_embeddings"
  | "ocr_page"
  | "text_to_speech"
  | "generate_items"
  | "extract_units"
  | "generate_candidates"
  | "verify_item";


export type Provider = "lovable" | "openai";
export type TaskKind = "chat" | "embedding" | "tts";

export interface TaskConfig {
  task: TaskName;
  primaryModel: string;
  fallbackModels: string[];
  maxTokens: number;
  temperature: number;
  promptKey: string;
  /** Key into the schema registry (`schema.ts`). Omitted for free-text tasks. */
  outputSchema?: string;
  provider: Provider;
  kind: TaskKind;
  /** Deterministic tasks only — see cache.ts. Chat/tutoring is never cached. */
  cacheable: boolean;
  /** Per-owner request ceiling inside the limit window (see limits.ts). */
  windowLimit: number;
  windowSeconds: number;
}

export const TASKS: Record<TaskName, TaskConfig> = {
  chat: {
    task: "chat",
    primaryModel: "google/gemini-3.1-flash-lite",
    fallbackModels: [
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
    ],
    maxTokens: 2048,
    temperature: 0.7,
    promptKey: "chat.nexus",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 120,
    windowSeconds: 3600,
  },
  extract_memory: {
    task: "extract_memory",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 512,
    temperature: 0.2,
    promptKey: "extract_memory.v1",
    outputSchema: "extract_memory",
    provider: "lovable",
    kind: "chat",
    cacheable: true,
    windowLimit: 200,
    windowSeconds: 3600,
  },
  future_scenarios: {
    task: "future_scenarios",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 4096,
    temperature: 0.6,
    promptKey: "future_scenarios.v1",
    outputSchema: "future_scenarios",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 20,
    windowSeconds: 3600,
  },
  future_weekly_report: {
    task: "future_weekly_report",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 2048,
    temperature: 0.6,
    promptKey: "future_weekly_report.v1",
    outputSchema: "weekly_report",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 20,
    windowSeconds: 3600,
  },
  future_daily_coach: {
    task: "future_daily_coach",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 1024,
    temperature: 0.6,
    promptKey: "future_daily_coach.v1",
    outputSchema: "daily_coach",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 40,
    windowSeconds: 3600,
  },
  study_coach: {
    task: "study_coach",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 4096,
    temperature: 0.5,
    promptKey: "study_coach.v1",
    outputSchema: "study_plan_tasks",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 40,
    windowSeconds: 3600,
  },
  session_debrief: {
    task: "session_debrief",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 128,
    temperature: 0.5,
    promptKey: "session_debrief.v1",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 60,
    windowSeconds: 3600,
  },
  generate_chat_title: {
    task: "generate_chat_title",
    primaryModel: "google/gemini-2.5-flash-lite",
    fallbackModels: ["google/gemini-2.5-flash"],
    maxTokens: 20,
    temperature: 0.4,
    promptKey: "generate_chat_title.v1",
    provider: "lovable",
    kind: "chat",
    cacheable: true,
    windowLimit: 200,
    windowSeconds: 3600,
  },
  embeddings: {
    task: "embeddings",
    primaryModel: "google/gemini-embedding-001",
    fallbackModels: [],
    maxTokens: 0,
    temperature: 0,
    promptKey: "embeddings.v1",
    provider: "lovable",
    kind: "embedding",
    cacheable: true,
    windowLimit: 600,
    windowSeconds: 3600,
  },
  /**
   * E4 / M4.4 — user document embeddings. 1536-dim per Architecture v1, which
   * `document_chunks.embedding` and its HNSW index are sized for. Deliberately
   * separate from `embeddings` so the admin corpus (768-dim) is untouched.
   */
  doc_embeddings: {
    task: "doc_embeddings",
    primaryModel: "openai/text-embedding-3-small",
    fallbackModels: [],
    maxTokens: 0,
    temperature: 0,
    promptKey: "doc_embeddings.v1",
    provider: "lovable",
    kind: "embedding",
    cacheable: true,
    windowLimit: 2000,
    windowSeconds: 3600,
  },
  /** E4 / M4.3 — transcribe one rasterised page image. */
  ocr_page: {
    task: "ocr_page",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 4096,
    temperature: 0,
    promptKey: "ocr_page.v1",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 600,
    windowSeconds: 3600,
  },
  text_to_speech: {
    task: "text_to_speech",
    primaryModel: "tts-1-hd",
    fallbackModels: [],
    maxTokens: 0,
    temperature: 0,
    promptKey: "text_to_speech.v1",
    provider: "openai",
    kind: "tts",
    cacheable: false,
    windowLimit: 60,
    windowSeconds: 3600,
  },
  /** E5.1 — generate study items from document chunks. */
  generate_items: {
    task: "generate_items",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 4096,
    temperature: 0.3,
    promptKey: "generate_items.v1",
    outputSchema: "study_items",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 100,
    windowSeconds: 3600,
  },
  /** E5 Phase C — propose grounded knowledge units from a bounded chunk set. */
  extract_units: {
    task: "extract_units",
    primaryModel: "google/gemini-3.1-flash-lite",
    fallbackModels: ["google/gemini-2.5-flash"],
    maxTokens: 2048,
    temperature: 0.2,
    promptKey: "extract_units.v1",
    outputSchema: "knowledge_units",
    provider: "lovable",
    kind: "chat",
    cacheable: true,
    windowLimit: 200,
    windowSeconds: 3600,
  },
  /** E5 Phase C — propose item candidates for specific knowledge units. */
  generate_candidates: {
    task: "generate_candidates",
    primaryModel: "google/gemini-2.5-flash",
    fallbackModels: ["google/gemini-3.1-flash-lite"],
    maxTokens: 3072,
    temperature: 0.3,
    promptKey: "generate_candidates.v1",
    outputSchema: "item_candidates",
    provider: "lovable",
    kind: "chat",
    cacheable: false,
    windowLimit: 200,
    windowSeconds: 3600,
  },
  /** E5 Phase C — independent grounding/entailment verifier. */
  verify_item: {
    task: "verify_item",
    primaryModel: "google/gemini-3.1-flash-lite",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    maxTokens: 384,
    temperature: 0,
    promptKey: "verify_item.v1",
    outputSchema: "item_verification",
    provider: "lovable",
    kind: "chat",
    cacheable: true,
    windowLimit: 600,
    windowSeconds: 3600,
  },
};


export function getTask(task: TaskName): TaskConfig {
  const config = TASKS[task];
  if (!config) throw new Error(`unknown_ai_task:${task}`);
  return config;
}

export const TASK_NAMES = Object.keys(TASKS) as TaskName[];