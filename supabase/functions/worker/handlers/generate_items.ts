/**
 * DEPRECATED — legacy M5.1 eager generator.
 *
 * Knowledge Engine (E5) replaces this: model output is now written to
 * `item_candidates`, validated, and only then published as an immutable
 * `item_versions` row. Nothing enqueues this kind any more; the handler stays
 * registered only so queued legacy jobs drain instead of dead-lettering.
 */
import { Job, JobContext } from "../../_shared/queue.ts";

export async function generateItemsHandler(job: Job, ctx: JobContext): Promise<void> {
  ctx.log.warn("generate_items.deprecated", {
    job_id: job.id,
    document_id: job.payload.document_id ?? null,
  });
}
