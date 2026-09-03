/**
 * E2 / M2.2 — the handler registry. E4 registers the ingestion pipeline.
 *
 * Pipeline: the client extracts and uploads pages, then enqueues `ocr` (scanned
 * pages) or `chunk` directly; `chunk` enqueues `embed`. Every handler must be
 * idempotent — see `_shared/queue.ts`.
 *
 * `__noop` exists only so the concurrency, backoff and dead-letter tests have a
 * handler to drive; it does nothing to product state.
 */
import { Job, JobContext, JobHandler } from "../_shared/queue.ts";
import { ocrHandler } from "./handlers/ocr.ts";
import { chunkHandler } from "./handlers/chunk.ts";
import { embedHandler } from "./handlers/embed.ts";
import { generateItemsHandler } from "./handlers/generate_items.ts";
import { generateCandidateHandler } from "./handlers/generate_candidate.ts";
import { validateCandidateHandler } from "./handlers/validate_candidate.ts";
import { publishItemHandler } from "./handlers/publish_item.ts";

const noop: JobHandler = async (job: Job, ctx: JobContext) => {
  // Test-only kinds. `__fail` always throws so the poison-message path is exercisable.
  if (job.kind === "__fail") throw new Error("intentional test failure");
  ctx.log.debug("job.noop", { job_id: job.id, kind: job.kind });
};

export const handlers: Record<string, JobHandler> = {
  __noop: noop,
  __fail: noop,
  ocr: ocrHandler,
  chunk: chunkHandler,
  embed: embedHandler,
  generate_items: generateItemsHandler,
  generate_candidate: generateCandidateHandler,
  validate_candidate: validateCandidateHandler,
  publish_item: publishItemHandler,
};

export const registeredKinds = () => Object.keys(handlers);