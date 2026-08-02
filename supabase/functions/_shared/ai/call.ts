/**
 * E3 / M3.1 — the single governed AI boundary.
 *
 * Every model request in StudyTime goes through `callModel` / `streamModel` /
 * `embed` / `speak`. Nothing else in the codebase may talk to a provider.
 *
 * Responsibilities: prompt resolution, model routing, retries with jittered
 * backoff, redaction, schema validation, metering and the `ai_calls` ledger.
 */
import { getTask, Provider, TaskName } from "./tasks.ts";
import {
  ProviderError,
  Route,
  endpointFor,
  providerBase,
  resolveRoute,
  runWithFallback,
} from "./router.ts";
import { SchemaRejected, validateWithRepair } from "./schema.ts";
import { Meter, computeCostUsd, estimateTokens, extractUsage } from "./meter.ts";
import { checkLimit, supabaseUsageCounter } from "./limits.ts";
import { getEntitlement } from "./entitlements.ts";
import { cacheGet, cacheKey, cacheSet, isCacheable } from "./cache.ts";
import { redact } from "./redact.ts";

export { ProviderError, SchemaRejected };

/**
 * Credential verification for a BYO provider key. This is not a model call, but
 * it is still a provider call, so it lives behind the boundary like the rest.
 */
export async function verifyProviderKey(
  provider: Provider,
  apiKey: string,
  traceId: string,
): Promise<{ ok: boolean; status: number; models: string[] }> {
  const res = await fetch(`${providerBase(provider)}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, "X-Trace-Id": traceId },
  });
  if (!res.ok) return { ok: false, status: res.status, models: [] };
  const body = await res.json().catch(() => ({ data: [] }));
  const models: string[] = (body?.data ?? [])
    .map((m: { id?: unknown }) => m?.id)
    .filter((id: unknown): id is string => typeof id === "string");
  return { ok: true, status: res.status, models };
}
export { UNTRUSTED_GUARD, fenceData, fenceToolResult, untrustedMessage } from "./untrusted.ts";
export { redact, redactDeep } from "./redact.ts";

export class AiLimitError extends Error {
  readonly code = "rate_limited";
  constructor(readonly reason: "rate_limited" | "usage_unknown") {
    super(`ai_limit:${reason}`);
    this.name = "AiLimitError";
  }
}

export interface AiContext {
  /** Service-role Supabase client, used for prompts, limits and the ledger. */
  supabase: any;
  ownerId: string;
  traceId: string;
  /** Optional BYO provider (user-supplied OpenAI key). */
  byo?: { provider: Provider; apiKey: string; model: string };
  log?: { warn: (m: string, f?: Record<string, unknown>) => void };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  [k: string]: unknown;
}

export interface ChatInput {
  messages: ChatMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  maxTokens?: number;
  temperature?: number;
  /** Key into the schema registry; enables validation + one repair round. */
  schemaKey?: string;
  /** Extra provider body fields the task legitimately needs. */
  extraBody?: Record<string, unknown>;
  /**
   * Ask the router for a specific model inside this task's chain (intent
   * routing in chat). Models outside the chain are only honoured for BYO.
   */
  preferModel?: string;
  /** Cache identity for deterministic tasks. Defaults to the messages. */
  cacheInput?: unknown;
}

export interface AiResult<T = unknown> {
  text: string;
  raw: any;
  parsed?: T;
  model: string;
  provider: Provider;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  traceId: string;
  promptVersion: string;
}

/* ------------------------------------------------------------------ prompts */

export interface ResolvedPrompt {
  systemPrompt: string | null;
  promptVersion: string;
  fewShots: Array<{ user: string; assistant: string }>;
}

/**
 * Prompt resolution order: the active row for this task, then the global active
 * row, then the caller's built-in default.
 */
export async function resolvePrompt(
  ctx: AiContext,
  task: TaskName,
  fallbackPrompt: string | null = null,
): Promise<ResolvedPrompt> {
  const config = getTask(task);
  try {
    const { data } = await ctx.supabase
      .from("ai_prompt_versions")
      .select("id, system_prompt, few_shots, task")
      .eq("is_active", true)
      .or(`task.eq.${task},task.is.null`)
      .order("task", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.system_prompt) {
      return {
        systemPrompt: data.system_prompt,
        promptVersion: data.id,
        fewShots: Array.isArray(data.few_shots) ? data.few_shots : [],
      };
    }
  } catch (e) {
    ctx.log?.warn("ai.prompt_resolve_failed", { task, detail: String(e) });
  }
  return { systemPrompt: fallbackPrompt, promptVersion: config.promptKey, fewShots: [] };
}

/* ------------------------------------------------------------------- ledger */

export interface LedgerRow {
  owner_id: string | null;
  task: TaskName;
  model: string;
  provider: Provider;
  trace_id: string;
  prompt_version: string | null;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  latency_ms: number;
  status: string;
  cache_hit: boolean;
  schema_retries: number;
}

/** Fire-and-forget. The ledger must never take a user request down with it. */
export function logAiCall(ctx: AiContext, row: LedgerRow): void {
  try {
    const p = ctx.supabase.from("ai_calls").insert(row);
    if (p?.then) {
      p.then((r: any) => {
        if (r?.error) ctx.log?.warn("ai.ledger_insert_failed", { detail: r.error.message });
      });
    }
  } catch (e) {
    ctx.log?.warn("ai.ledger_threw", { detail: String(e) });
  }
}

/* ------------------------------------------------------------------- guards */

async function guard(ctx: AiContext, task: TaskName): Promise<void> {
  const ent = getEntitlement(ctx.ownerId);
  if (!ent.allowed) throw new AiLimitError("rate_limited");
  const decision = await checkLimit(supabaseUsageCounter(ctx.supabase), ctx.ownerId, task);
  if (!decision.allowed) throw new AiLimitError(decision.reason ?? "rate_limited");
}

function apiKeyFor(provider: Provider, ctx: AiContext): string {
  if (ctx.byo && ctx.byo.provider === provider) return ctx.byo.apiKey;
  const key = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error(`missing_api_key:${provider}`);
  return key;
}

function headersFor(provider: Provider, ctx: AiContext): HeadersInit {
  const key = apiKeyFor(provider, ctx);
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "X-Trace-Id": ctx.traceId,
  };
  if (provider === "lovable") base["Lovable-API-Key"] = key;
  return base;
}

/** Redact every string that leaves the platform. */
function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    content: typeof m.content === "string" ? redact(m.content) : m.content,
  }));
}

function textFrom(payload: any): string {
  const msg = payload?.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content;
  const toolArgs = msg.tool_calls?.[0]?.function?.arguments;
  return typeof toolArgs === "string" ? toolArgs : "";
}

/* --------------------------------------------------------------- callModel */

export async function callModel<T = unknown>(
  task: TaskName,
  input: ChatInput,
  ctx: AiContext,
): Promise<AiResult<T>> {
  const config = getTask(task);
  await guard(ctx, task);

  const route: Route = resolveRoute(task, {
    preferModel: ctx.byo ? ctx.byo.model : input.preferModel,
    provider: ctx.byo?.provider,
  });
  const meter = new Meter();
  const messages = sanitizeMessages(input.messages);
  const promptVersion = String(input.extraBody?.prompt_version ?? config.promptKey);

  const cacheable = isCacheable(task);
  const key = cacheable
    ? await cacheKey({
      task,
      model: route.models[0],
      promptVersion,
      input: input.cacheInput ?? messages,
    })
    : "";
  if (cacheable) {
    const hit = cacheGet<AiResult<T>>(key);
    if (hit) {
      logAiCall(ctx, {
        owner_id: ctx.ownerId,
        task,
        model: hit.model,
        provider: route.provider,
        trace_id: ctx.traceId,
        prompt_version: promptVersion,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "ok",
        cache_hit: true,
        schema_retries: 0,
      });
      return { ...hit, cacheHit: true, traceId: ctx.traceId };
    }
  }

  const body = (model: string, msgs: ChatMessage[]) => ({
    model,
    messages: msgs,
    max_tokens: input.maxTokens ?? config.maxTokens,
    temperature: input.temperature ?? config.temperature,
    ...(input.tools ? { tools: input.tools } : {}),
    ...(input.toolChoice ? { tool_choice: input.toolChoice } : {}),
    ...(input.extraBody ?? {}),
  });

  const post = async (model: string, msgs: ChatMessage[]) => {
    const res = await fetch(endpointFor(route.provider, "chat"), {
      method: "POST",
      headers: headersFor(route.provider, ctx),
      body: JSON.stringify(body(model, msgs)),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      ctx.log?.warn("ai.provider_error", { task, model, status: res.status, detail: detail.slice(0, 300) });
      return { ok: false, status: res.status, error: detail };
    }
    return { ok: true, status: res.status, value: await res.json() };
  };

  let status = "ok";
  let schemaRetries = 0;

  try {
    const outcome = await runWithFallback<any>({
      route,
      attempt: (model) => post(model, messages),
      onRetry: (i) => ctx.log?.warn("ai.retry", { task, ...i }),
    });

    const payload = outcome.value;
    meter.add(outcome.model, extractUsage(payload));
    const text = textFrom(payload);

    let parsed: T | undefined;
    const schemaKey = input.schemaKey ?? config.outputSchema;
    if (schemaKey) {
      const validated = await validateWithRepair<T>(schemaKey, text, async (issues) => {
        const repairMessages: ChatMessage[] = [
          ...messages,
          { role: "assistant", content: text },
          {
            role: "user",
            content:
              `Your previous output failed validation: ${issues.join("; ")}. ` +
              "Reply with corrected JSON only — no prose, no code fences.",
          },
        ];
        const repair = await post(outcome.model, repairMessages);
        if (!repair.ok) return null;
        meter.add(outcome.model, extractUsage(repair.value));
        return textFrom(repair.value);
      });
      parsed = validated.value;
      schemaRetries = validated.retries;
    }

    const result: AiResult<T> = {
      text,
      raw: payload,
      parsed,
      model: outcome.model,
      provider: route.provider,
      costUsd: meter.costUsd(),
      latencyMs: meter.latencyMs(),
      cacheHit: false,
      traceId: ctx.traceId,
      promptVersion,
    };
    if (cacheable) cacheSet(key, { ...result, raw: null });
    return result;
  } catch (err) {
    status = err instanceof SchemaRejected
      ? "schema_rejected"
      : err instanceof ProviderError
      ? `provider_${err.status}`
      : "error";
    if (err instanceof SchemaRejected) schemaRetries = err.retries;
    throw err;
  } finally {
    logAiCall(ctx, {
      owner_id: ctx.ownerId,
      task,
      model: meter.model || route.models[0],
      provider: route.provider,
      trace_id: ctx.traceId,
      prompt_version: promptVersion,
      tokens_input: meter.usage.tokensInput,
      tokens_output: meter.usage.tokensOutput,
      cost_usd: meter.costUsd(),
      latency_ms: meter.latencyMs(),
      status,
      cache_hit: false,
      schema_retries: schemaRetries,
    });
  }
}

/* -------------------------------------------------------------- streamModel */

export interface StreamResult {
  body: ReadableStream<Uint8Array> | null;
  model: string;
  promptVersion: string;
}

/**
 * Streaming chat. The ledger row is written when the request is accepted;
 * token counts are estimated from the prompt because SSE deltas do not carry a
 * usage block on every provider.
 */
export async function streamModel(
  task: TaskName,
  input: ChatInput,
  ctx: AiContext,
): Promise<StreamResult> {
  const config = getTask(task);
  await guard(ctx, task);

  const route = resolveRoute(task, {
    preferModel: ctx.byo ? ctx.byo.model : input.preferModel,
    provider: ctx.byo?.provider,
  });
  const messages = sanitizeMessages(input.messages);
  const meter = new Meter();
  const promptVersion = String(input.extraBody?.prompt_version ?? config.promptKey);
  const promptChars = messages.reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );

  let status = "ok";
  let model = route.models[0];
  try {
    const outcome = await runWithFallback<Response>({
      route,
      attempt: async (m) => {
        const res = await fetch(endpointFor(route.provider, "chat"), {
          method: "POST",
          headers: headersFor(route.provider, ctx),
          body: JSON.stringify({
            model: m,
            messages,
            stream: true,
            max_tokens: input.maxTokens ?? config.maxTokens,
            temperature: input.temperature ?? config.temperature,
            ...(input.extraBody ?? {}),
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          ctx.log?.warn("ai.stream_error", { task, model: m, status: res.status, detail: detail.slice(0, 300) });
          return { ok: false, status: res.status, error: detail };
        }
        return { ok: true, status: res.status, value: res };
      },
      onRetry: (i) => ctx.log?.warn("ai.retry", { task, ...i }),
    });
    model = outcome.model;
    meter.add(model, { tokensInput: estimateTokens("x".repeat(promptChars)), tokensOutput: 0 });
    return { body: outcome.value.body, model, promptVersion };
  } catch (err) {
    status = err instanceof ProviderError ? `provider_${err.status}` : "error";
    throw err;
  } finally {
    logAiCall(ctx, {
      owner_id: ctx.ownerId,
      task,
      model,
      provider: route.provider,
      trace_id: ctx.traceId,
      prompt_version: promptVersion,
      tokens_input: meter.usage.tokensInput,
      tokens_output: 0,
      cost_usd: computeCostUsd(model, meter.usage),
      latency_ms: meter.latencyMs(),
      status,
      cache_hit: false,
      schema_retries: 0,
    });
  }
}

/* -------------------------------------------------------------- embeddings */

export async function embed(
  input: string | string[],
  ctx: AiContext,
  dimensions = 768,
): Promise<number[][]> {
  const task: TaskName = "embeddings";
  const config = getTask(task);
  await guard(ctx, task);

  const route = resolveRoute(task);
  const meter = new Meter();
  const payloadInput = Array.isArray(input) ? input.map(redact) : redact(input);
  let status = "ok";
  let model = route.models[0];

  try {
    const outcome = await runWithFallback<any>({
      route,
      attempt: async (m) => {
        const res = await fetch(endpointFor(route.provider, "embedding"), {
          method: "POST",
          headers: headersFor(route.provider, ctx),
          body: JSON.stringify({ model: m, input: payloadInput, dimensions }),
        });
        if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => "") };
        return { ok: true, status: res.status, value: await res.json() };
      },
    });
    model = outcome.model;
    meter.add(model, extractUsage(outcome.value));
    return (outcome.value.data ?? []).map((d: { embedding: number[] }) => d.embedding);
  } catch (err) {
    status = err instanceof ProviderError ? `provider_${err.status}` : "error";
    throw err;
  } finally {
    logAiCall(ctx, {
      owner_id: ctx.ownerId,
      task,
      model,
      provider: route.provider,
      trace_id: ctx.traceId,
      prompt_version: config.promptKey,
      tokens_input: meter.usage.tokensInput,
      tokens_output: 0,
      cost_usd: meter.costUsd(),
      latency_ms: meter.latencyMs(),
      status,
      cache_hit: false,
      schema_retries: 0,
    });
  }
}

/* ------------------------------------------------------------ text-to-speech */

export async function speak(
  text: string,
  ctx: AiContext,
  opts: { voice?: string; speed?: number; format?: string } = {},
): Promise<ArrayBuffer> {
  const task: TaskName = "text_to_speech";
  const config = getTask(task);
  await guard(ctx, task);

  const route = resolveRoute(task);
  const meter = new Meter();
  let status = "ok";
  let model = route.models[0];

  try {
    const outcome = await runWithFallback<ArrayBuffer>({
      route,
      attempt: async (m) => {
        const res = await fetch(endpointFor(route.provider, "tts"), {
          method: "POST",
          headers: headersFor(route.provider, ctx),
          body: JSON.stringify({
            model: m,
            input: text,
            voice: opts.voice ?? "nova",
            response_format: opts.format ?? "mp3",
            speed: opts.speed ?? 0.95,
          }),
        });
        if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => "") };
        return { ok: true, status: res.status, value: await res.arrayBuffer() };
      },
    });
    model = outcome.model;
    meter.add(model, { tokensInput: text.length, tokensOutput: 0 });
    return outcome.value;
  } catch (err) {
    status = err instanceof ProviderError ? `provider_${err.status}` : "error";
    throw err;
  } finally {
    logAiCall(ctx, {
      owner_id: ctx.ownerId,
      task,
      model,
      provider: route.provider,
      trace_id: ctx.traceId,
      prompt_version: config.promptKey,
      tokens_input: meter.usage.tokensInput,
      tokens_output: 0,
      cost_usd: meter.costUsd(),
      latency_ms: meter.latencyMs(),
      status,
      cache_hit: false,
      schema_retries: 0,
    });
  }
}