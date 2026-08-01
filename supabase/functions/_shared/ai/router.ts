/**
 * E3 / M3.1 — task -> provider/model routing and the fallback chain.
 *
 * This module is pure: no fetch, no Deno, no Supabase. Everything that touches
 * the network is injected, which is what makes the fallback/backoff behaviour
 * testable in `tests/ai`.
 */
import { getTask, Provider, TaskConfig, TaskName } from "./tasks.ts";

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";
const OPENAI_BASE = "https://api.openai.com/v1";

export interface Route {
  task: TaskName;
  provider: Provider;
  /** Ordered model chain: primary first, then declared fallbacks. */
  models: string[];
  config: TaskConfig;
}

export interface ResolveOptions {
  /** A caller-owned model (BYO OpenAI key). Must still belong to a task. */
  preferModel?: string;
  provider?: Provider;
}

export function resolveRoute(task: TaskName, opts: ResolveOptions = {}): Route {
  const config = getTask(task);
  const provider = opts.provider ?? config.provider;
  const declared = [config.primaryModel, ...config.fallbackModels];

  let models = declared;
  if (opts.preferModel) {
    models = provider === config.provider && declared.includes(opts.preferModel)
      ? [opts.preferModel, ...declared.filter((m) => m !== opts.preferModel)]
      : [opts.preferModel];
  }

  return { task, provider, models, config };
}

export function endpointFor(provider: Provider, kind: TaskConfig["kind"]): string {
  const base = provider === "openai" ? OPENAI_BASE : LOVABLE_BASE;
  if (kind === "embedding") return `${base}/embeddings`;
  if (kind === "tts") return `${base}/audio/speech`;
  return `${base}/chat/completions`;
}

/** Retryable transport/provider statuses. Everything else is terminal. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 425 || status >= 500;
}

/** Exponential backoff with full jitter, capped. */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(250 * 2 ** attempt, 4000);
  return Math.round(base * (0.5 + random() * 0.5));
}

export interface AttemptResult<T> {
  ok: boolean;
  status: number;
  value?: T;
  error?: unknown;
}

export interface FallbackOptions<T> {
  route: Route;
  attempt: (model: string, attemptIndex: number) => Promise<AttemptResult<T>>;
  /** Retries per model before moving to the next model in the chain. */
  retriesPerModel?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { model: string; status: number; delayMs: number }) => void;
}

export interface FallbackOutcome<T> {
  value: T;
  model: string;
  attempts: number;
}

export class ProviderError extends Error {
  constructor(readonly status: number, message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Walk the model chain. Each model gets `retriesPerModel` retries on retryable
 * failures; a terminal failure (400/401/403) aborts immediately — retrying a
 * malformed request only burns money.
 */
export async function runWithFallback<T>(opts: FallbackOptions<T>): Promise<FallbackOutcome<T>> {
  const {
    route,
    attempt,
    retriesPerModel = 1,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
    onRetry,
  } = opts;

  let attempts = 0;
  let last: AttemptResult<unknown> = { ok: false, status: 0 };

  for (let m = 0; m < route.models.length; m++) {
    const model = route.models[m];
    for (let r = 0; r <= retriesPerModel; r++) {
      attempts++;
      let res: AttemptResult<T>;
      try {
        res = await attempt(model, attempts - 1);
      } catch (err) {
        res = { ok: false, status: 0, error: err };
      }
      if (res.ok) return { value: res.value as T, model, attempts };
      last = res;

      const retryable = res.status === 0 || isRetryableStatus(res.status);
      if (!retryable) {
        throw new ProviderError(res.status, `provider_rejected:${res.status}`, res.error);
      }
      const moreForThisModel = r < retriesPerModel;
      const moreModels = m < route.models.length - 1;
      if (!moreForThisModel && !moreModels) break;
      if (moreForThisModel) {
        const delayMs = backoffDelayMs(r, random);
        onRetry?.({ model, status: res.status, delayMs });
        await sleep(delayMs);
      }
    }
  }

  throw new ProviderError(last.status || 503, "all_models_failed", last.error);
}