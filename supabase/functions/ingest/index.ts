/**
 * E4 — the ingestion control plane.
 *
 * The heavy lifting happens elsewhere: extraction runs in the browser (M4.2) and
 * OCR / chunking / embedding run on the queue (M4.3–M4.4). This function only
 * does what the client cannot: validate ownership and enqueue jobs, since
 * `enqueue_job` is service-role only.
 */
import { serve } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { resolveOwner, requireUser, serviceClient } from "../_shared/owner.ts";
import { enqueue } from "../_shared/queue.ts";

const MAX_PAGES = 300;

Deno.serve(
  serve("ingest", async (ctx) => {
    const { req, traceId, log } = ctx;
    if (req.method !== "POST") throw new AppError("not_found");

    const owner = await resolveOwner(req);
    const userId = requireUser(owner);
    const svc = serviceClient();

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const documentId = String(body.document_id ?? "");
    if (!documentId) throw new AppError("validation_failed", "document_id is required.");

    const { data: doc } = await svc
      .from("documents").select("id, user_id, page_count").eq("id", documentId).maybeSingle();
    if (!doc) throw new AppError("not_found");
    if (doc.user_id !== userId) throw new AppError("forbidden");

    if (action === "process" || action === "retry") {
      if ((doc.page_count ?? 0) > MAX_PAGES) {
        await svc.from("documents").update({
          status: "failed",
          error: `This file has ${doc.page_count} pages. The limit is ${MAX_PAGES}.`,
        }).eq("id", documentId);
        throw new AppError("validation_failed", `Documents are limited to ${MAX_PAGES} pages.`);
      }

      const { count: ocrPages } = await svc
        .from("document_pages")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("needs_ocr", true);

      const kind = (ocrPages ?? 0) > 0 ? "ocr" : "chunk";

      if (action === "retry") {
        // A retry must be able to re-run a key that already completed.
        await svc.from("jobs").delete()
          .in("key", [`ocr:${documentId}`, `chunk:${documentId}`, `embed:${documentId}`]);
      }

      await svc.from("documents")
        .update({ status: kind === "ocr" ? "needs_ocr" : "chunking", error: null })
        .eq("id", documentId);

      const jobId = await enqueue(svc, kind, {
        key: `${kind}:${documentId}`,
        payload: { document_id: documentId },
        traceId,
      });

      log.info("ingest.enqueued", { document_id: documentId, kind, job_id: jobId });
      return json({ ok: true, kind, job_id: jobId, trace_id: traceId });
    }

    throw new AppError("validation_failed", "Unknown action.");
  }),
);