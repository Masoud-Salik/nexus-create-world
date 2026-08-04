/**
 * E2 / M2.2 — the worker.
 *
 * A single drain pass: claim leased jobs, run their handler, complete or fail.
 * Safe to run concurrently — `claim_jobs` uses FOR UPDATE SKIP LOCKED plus a
 * lease, so two drains can never take the same row.
 *
 * Invoked by the `queue-drain` cron every minute (see
 * docs/runbooks/ingestion-schedules.md) or manually with the service role key.
 * When a job dies for good, the document it belongs to is marked `failed` in the
 * same pass so the Library never spins forever.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serve } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { serviceClient } from "../_shared/owner.ts";
import { claim, complete, fail, Job } from "../_shared/queue.ts";
import { handlers, registeredKinds } from "./handlers.ts";

/** Stop claiming new work past this point so the invocation is never killed mid-job. */
const DRAIN_BUDGET_MS = 45_000;
const LEASE_SECONDS = 120;
const BATCH_SIZE = 10;

/**
 * Two callers: an operator holding the service role key, and the cron schedule,
 * which cannot read that key and presents `WORKER_SCHEDULER_TOKEN` instead.
 */
function authorize(req: Request) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const header = req.headers.get("Authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
  if (serviceKey && bearer === serviceKey) return;

  const cronToken = Deno.env.get("WORKER_SCHEDULER_TOKEN");
  const presented = req.headers.get("x-worker-token") ?? "";
  if (cronToken && presented === cronToken) return;

  throw new AppError("unauthorized");
}

/** User-safe copy for a permanently failed ingestion stage. */
const DEAD_MESSAGE: Record<string, string> = {
  ocr: "We could not read the text in this file. Try uploading a clearer copy.",
  chunk: "We could not organise this document. Try again, or upload it once more.",
  embed: "We could not finish indexing this document. Try again in a few minutes.",
};

/**
 * Dead job → failed document. Idempotent, and never overwrites a document that
 * already reached a terminal state.
 */
async function reconcileDeadJob(svc: SupabaseClient, job: Job): Promise<void> {
  const message = DEAD_MESSAGE[job.kind];
  const documentId = String(job.payload?.document_id ?? "");
  if (!message || !documentId) return;
  await svc.from("documents")
    .update({ status: "failed", error: message })
    .eq("id", documentId)
    .not("status", "in", "(failed,ready)");
}

Deno.serve(
  serve("worker", async (ctx) => {
    const { req, log } = ctx;
    if (req.method !== "POST") throw new AppError("not_found");
    authorize(req);

    const svc = serviceClient();
    const kindFilter = ctx.url.searchParams.get("kind");
    const startedAt = Date.now();

    let processed = 0;
    let failed = 0;
    let deadLettered = 0;

    while (Date.now() - startedAt < DRAIN_BUDGET_MS) {
      const batch: Job[] = await claim(svc, kindFilter, BATCH_SIZE, LEASE_SECONDS);
      if (batch.length === 0) break;

      for (const job of batch) {
        const traceId = job.trace_id ?? ctx.traceId;
        const jobLog = log.child({ job_id: job.id, job_kind: job.kind, attempt: job.attempts });
        const handler = handlers[job.kind];

        if (!handler) {
          const status = await fail(svc, job.id, `no handler registered for kind "${job.kind}"`);
          failed++;
          if (status === "dead") {
            deadLettered++;
            await reconcileDeadJob(svc, job);
            jobLog.error("job.dead_lettered", { reason: "no_handler", job_trace_id: traceId });
          } else {
            jobLog.warn("job.failed", { reason: "no_handler", job_trace_id: traceId });
          }
          continue;
        }

        try {
          await handler(job, { log: jobLog, svc, traceId });
          await complete(svc, job.id);
          processed++;
          jobLog.info("job.completed", { job_trace_id: traceId });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = await fail(svc, job.id, message);
          failed++;
          if (status === "dead") {
            deadLettered++;
            await reconcileDeadJob(svc, job);
            jobLog.error("job.dead_lettered", { detail: message, job_trace_id: traceId });
          } else {
            jobLog.warn("job.failed", { detail: message, job_trace_id: traceId });
          }
        }
      }
    }

    log.info("drain.finished", {
      processed,
      failed,
      dead_lettered: deadLettered,
      duration_ms: log.elapsedMs(),
      kinds: registeredKinds(),
    });

    return json({ processed, failed, dead_lettered: deadLettered });
  }),
);