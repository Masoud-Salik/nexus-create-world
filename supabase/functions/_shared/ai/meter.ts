/**
 * E3 / M3.2 — token, cost and latency metering.
 *
 * Cost, not compute, is the ceiling (see docs/runbooks/cost-overrun.md), so
 * every call is priced even when the provider omits usage.
 */

export interface Usage {
  tokensInput: number;
  tokensOutput: number;
}

/** USD per 1M tokens: [input, output]. Approximate list pricing. */
export const PRICING: Record<string, [number, number]> = {
  "google/gemini-3.1-flash-lite": [0.1, 0.4],
  "google/gemini-3-flash-preview": [0.3, 2.5],
  "google/gemini-3.5-flash": [0.3, 2.5],
  "google/gemini-2.5-flash": [0.3, 2.5],
  "google/gemini-2.5-flash-lite": [0.1, 0.4],
  "google/gemini-2.5-pro": [1.25, 10],
  "google/gemini-embedding-001": [0.15, 0],
  "openai/gpt-5-mini": [0.25, 2],
  "openai/gpt-5-nano": [0.05, 0.4],
  "openai/gpt-5": [1.25, 10],
  "gpt-5-mini": [0.25, 2],
  "gpt-5-nano": [0.05, 0.4],
  "gpt-5": [1.25, 10],
  "tts-1-hd": [30, 0],
};

const DEFAULT_PRICE: [number, number] = [0.5, 2];

export function priceFor(model: string): [number, number] {
  return PRICING[model] ?? DEFAULT_PRICE;
}

export function computeCostUsd(model: string, usage: Usage): number {
  const [inPrice, outPrice] = priceFor(model);
  const cost =
    (usage.tokensInput / 1_000_000) * inPrice + (usage.tokensOutput / 1_000_000) * outPrice;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rough fallback when the provider returns no usage block (streaming). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function extractUsage(payload: unknown): Usage {
  const u = (payload as { usage?: Record<string, number> } | null)?.usage;
  return {
    tokensInput: Number(u?.prompt_tokens ?? u?.input_tokens ?? 0) || 0,
    tokensOutput: Number(u?.completion_tokens ?? u?.output_tokens ?? 0) || 0,
  };
}

export class Meter {
  private startedAt = Date.now();
  usage: Usage = { tokensInput: 0, tokensOutput: 0 };
  model = "";

  add(model: string, usage: Usage) {
    this.model = model;
    this.usage.tokensInput += usage.tokensInput;
    this.usage.tokensOutput += usage.tokensOutput;
  }

  latencyMs(): number {
    return Date.now() - this.startedAt;
  }

  costUsd(): number {
    return computeCostUsd(this.model, this.usage);
  }
}