/**
 * E2 / M2.2 — the handler registry.
 *
 * Deliberately empty for E2: the queue ships with no consumers. E4 (ingestion)
 * and E5 (item generation) register `parse`, `ocr`, `chunk`, `embed` and
 * `generate` here. Every handler must be idempotent — see `_shared/queue.ts`.
 *
 * `__noop` exists only so the concurrency, backoff and dead-letter tests have a
 * handler to drive; it does nothing to product state.
 */
import { Job, JobContext, JobHandler } from "../_shared/queue.ts";

const noop: JobHandler = async (job: Job, ctx: JobContext) => {
  // Test-only kinds. `__fail` always throws so the poison-message path is exercisable.
  if (job.kind === "__fail") throw new Error("intentional test failure");
  ctx.log.debug("job.noop", { job_id: job.id, kind: job.kind });
};

export const handlers: Record<string, JobHandler> = {
  __noop: noop,
  __fail: noop,
};

export const registeredKinds = () => Object.keys(handlers);