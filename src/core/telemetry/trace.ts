/**
 * E1 / M1.5 — client-side trace ids.
 *
 * Every outbound request carries `X-Trace-Id`. Edge functions and queue jobs reuse
 * it, so one id ties a user action to its server logs and any async work it spawned.
 */

export function newTraceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Idempotency keys are required on every state-mutating POST. */
export function newIdempotencyKey(): string {
  return newTraceId();
}