/**
 * E2 / M2.2 — the handler registry. E4 registers the ingestion pipeline, E5
 * Phase C the Knowledge Engine pipeline.
 *
 * Pipeline: the client extracts and uploads pages, then enqueues `ocr` (scanned
 * pages) or `chunk` directly; `chunk` enqueues `embed`; `embed` enqueues
 * `extract_units`, which requests a bounded starter batch → `generate_candidates`
 * → `validate_candidates` → published item versions.
 *
 * Every handler must be idempotent — see `_shared/queue.ts`.
 *
 * `__noop` exists only so the concurrency, backoff and dead-letter tests have a
 * handler to drive; it does nothing to product state.
 */
import { Job, JobContext, JobHandler } from "../_shared/queue.ts";
import { ocrHandler } from "./handlers/ocr.ts";
import { chunkHandler } from "./handlers/chunk.ts";
import { embedHandler } from "./handlers/embed.ts";
import { generateItemsHandler } from "./handlers/generate_items.ts";
import { extractUnitsHandler } from "./handlers/extract_units.ts";
import { generateCandidatesHandler } from "./handlers/generate_candidates.ts";
import { validateCandidatesHandler } from "./handlers/validate_candidates.ts";

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
  extract_units: extractUnitsHandler,
  generate_candidates: generateCandidatesHandler,
  validate_candidates: validateCandidatesHandler,
};

export const registeredKinds = () => Object.keys(handlers);
