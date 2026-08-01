/**
 * E3 / M3.3 — outbound redaction.
 *
 * Nothing that looks like a credential leaves the platform inside a prompt.
 * This runs on every context string before it reaches a provider.
 */

const RULES: Array<[RegExp, string]> = [
  // Provider / platform API keys
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\b(?:rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, "[REDACTED_API_KEY]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_API_KEY]"],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_API_KEY]"],
  // Bearer tokens and JWTs
  [/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, "Bearer [REDACTED_TOKEN]"],
  [/\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_TOKEN]"],
  // key=value secrets
  [
    /\b(api[_-]?key|secret|password|passwd|token|authorization)\b\s*[:=]\s*["']?[^\s"',;]{8,}/gi,
    "$1=[REDACTED_SECRET]",
  ],
  // Contact identifiers
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]"],
  // Postgres / connection strings
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/gi, "[REDACTED_URI]"],
];

export function redact(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [re, replacement] of RULES) out = out.replace(re, replacement);
  return out;
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v);
    return out as T;
  }
  return value;
}

export function containsSecret(input: string): boolean {
  return redact(input) !== input;
}