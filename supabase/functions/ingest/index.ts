/**
 * E4 — the ingestion control plane.
 *
 * The heavy lifting happens elsewhere: extraction runs in the browser (M4.2) and
 * OCR / chunking / embedding run on the queue (M4.3–M4.4). This function only
 * does what the client cannot: enforce quotas, validate ownership, verify that a
 * retry can actually succeed, and enqueue jobs (`enqueue_job` is service-role
 * only).
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serve } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { resolveOwner, requireUser, serviceClient } from "../_shared/owner.ts";
import { enqueue } from "../_shared/queue.ts";
import { humanBytes, limitsFor } from "../_shared/ingest/limits.ts";

const BUCKET = "user-documents";

/** Storage `list` is capped per call, so page through the whole prefix. */
async function listPrefix(svc: SupabaseClient, prefix: string): Promise<Set<string>> {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await svc.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const f of data) names.add(f.name);
    if (data.length < 1000) break;
  }
  return names;
}

async function failDocument(svc: SupabaseClient, id: string, message: string): Promise<never> {
  await svc.from("documents").update({ status: "failed", error: message }).eq("id", id);
  throw new AppError("validation_failed", message);
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/plain",
  "text/markdown",
]);

/**
 * The client uploads straight to storage, so the browser's own size/type checks
 * are advisory. Re-verify the stored object here — before any paid work is
 * enqueued — so a crafted client cannot buy itself unlimited OCR.
 */
async function verifySource(
  svc: SupabaseClient,
  userId: string,
  documentId: string,
  maxBytes: number,
): Promise<void> {
  const { data } = await svc.storage
    .from(BUCKET)
    .list(`${userId}/${documentId}`, { limit: 1, search: "source" });
  const source = data?.find((f) => f.name === "source");
  if (!source) return; // absence is handled by the retry recovery path
  const size = Number(source.metadata?.size ?? 0);
  const mime = String(source.metadata?.mimetype ?? "");
  if (size > maxBytes) {
    await failDocument(svc, documentId, `Files are limited to ${humanBytes(maxBytes)}.`);
  }
  if (mime && !ALLOWED_MIME.has(mime)) {
    await failDocument(svc, documentId, "That file type is not supported.");
  }
}

Deno.serve(
  serve("ingest", async (ctx) => {
    const { req, traceId, log } = ctx;
    if (req.method !== "POST") throw new AppError("not_found");

    const owner = await resolveOwner(req);
    const userId = requireUser(owner);
    const svc = serviceClient();

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const limits = limitsFor(userId);

    // ---- preflight: quota gate, called before the document row is created.
    if (action === "preflight") {
      const bytes = Number(body.bytes ?? 0);
      const pageCount = Number(body.page_count ?? 0);
      const ocrPages = Number(body.ocr_pages ?? 0);
      if (!Number.isFinite(bytes) || bytes <= 0) {
        throw new AppError("validation_failed", "The file is empty.");
      }
      if (bytes > limits.maxBytes) {
        throw new AppError("validation_failed", `Files are limited to ${humanBytes(limits.maxBytes)}.`);
      }
      if (pageCount > limits.maxPages) {
        throw new AppError("validation_failed", `Documents are limited to ${limits.maxPages} pages.`);
      }
      if (ocrPages > limits.maxOcrPages) {
        throw new AppError(
          "validation_failed",
          `This file needs text recognition on ${ocrPages} pages; the limit is ${limits.maxOcrPages}. Split it into smaller files.`,
        );
      }

      const { data: existing, error: quotaErr } = await svc
        .from("documents").select("bytes").eq("user_id", userId);
      if (quotaErr) throw new AppError("internal", undefined, quotaErr);
      const used = (existing ?? []).reduce((sum: number, d: { bytes: number }) => sum + (d.bytes ?? 0), 0);
      if ((existing?.length ?? 0) >= limits.maxDocuments) {
        throw new AppError(
          "quota_exceeded",
          `Your library is full (${limits.maxDocuments} documents). Delete something to add more.`,
        );
      }
      if (used + bytes > limits.maxStorageBytes) {
        throw new AppError(
          "quota_exceeded",
          `That would exceed your ${humanBytes(limits.maxStorageBytes)} of storage. Delete something to free space.`,
        );
      }
      return json({ ok: true, limits, used_bytes: used, document_count: existing?.length ?? 0 });
    }

    const documentId = String(body.document_id ?? "");
    if (!documentId) throw new AppError("validation_failed", "document_id is required.");

    const { data: doc } = await svc
      .from("documents")
      .select("id, user_id, page_count, retry_count, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) throw new AppError("not_found");
    if (doc.user_id !== userId) throw new AppError("forbidden");

    if (action === "process" || action === "retry") {
      if ((doc.page_count ?? 0) > limits.maxPages) {
        await failDocument(
          svc,
          documentId,
          `This file has ${doc.page_count} pages. The limit is ${limits.maxPages}.`,
        );
      }
      await verifySource(svc, userId, documentId, limits.maxBytes);

      if (action === "retry") {
        // A retry must either recover or fail cleanly — never loop forever.
        if ((doc.retry_count ?? 0) >= limits.maxRetries) {
          await failDocument(
            svc,
            documentId,
            "This document has failed too many times. Delete it and upload the file again.",
          );
        }
        await svc.from("documents")
          .update({ retry_count: (doc.retry_count ?? 0) + 1 })
          .eq("id", documentId);

        const objects = await listPrefix(svc, `${userId}/${documentId}`);

        // 1. The original upload must still exist.
        if (!objects.has("source")) {
          await failDocument(
            svc,
            documentId,
            "The original file is no longer stored. Please upload it again.",
          );
        }
        if (!doc.storage_path) {
          await svc.from("documents")
            .update({ storage_path: `${userId}/${documentId}/source` })
            .eq("id", documentId);
        }

        // 2. The extracted page rows must exist — they are produced in the browser.
        const { count: pageRows } = await svc
          .from("document_pages").select("id", { count: "exact", head: true })
          .eq("document_id", documentId);
        if (!pageRows) {
          await failDocument(
            svc,
            documentId,
            "The extracted pages are missing. Please upload this file again.",
          );
        }

        // 3. Pages whose rasterised image never made it can never be OCR'd. Skip
        //    them so the rest of the document still finishes, unless nothing is
        //    left to read at all.
        const { data: ocrCandidates } = await svc
          .from("document_pages").select("id, page_no")
          .eq("document_id", documentId).eq("needs_ocr", true);
        const missing = (ocrCandidates ?? []).filter(
          (p: { page_no: number }) => !objects.has(`page-${p.page_no}.png`),
        );
        if (missing.length) {
          const { count: withText } = await svc
            .from("document_pages").select("id", { count: "exact", head: true })
            .eq("document_id", documentId).neq("text", "");
          if (!withText && missing.length === (ocrCandidates?.length ?? 0)) {
            await failDocument(
              svc,
              documentId,
              "The scanned page images are missing, so this file cannot be re-read. Please upload it again.",
            );
          }
          await svc.from("document_pages")
            .update({ needs_ocr: false, ocr_confidence: 0 })
            .in("id", missing.map((p: { id: string }) => p.id));
          log.warn("ingest.retry_skipped_pages", { document_id: documentId, pages: missing.length });
        }
      }

      const { count: ocrPages } = await svc
        .from("document_pages")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("needs_ocr", true);

      const kind = (ocrPages ?? 0) > 0 ? "ocr" : "chunk";

      if ((ocrPages ?? 0) > limits.maxOcrPages) {
        await failDocument(
          svc,
          documentId,
          `This file needs text recognition on ${ocrPages} pages; the limit is ${limits.maxOcrPages}.`,
        );
      }

      if (action === "retry") {
        // A retry must be able to re-run a key that already completed or died.
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

    // ---- prepare: request bounded starter inventory for a ready document.
    // E5 — demand-driven generation. Creates knowledge units from the document's
    // chunks, then enqueues generation_requests for a bounded starter set.
    if (action === "prepare") {
      if (doc.user_id !== userId) throw new AppError("forbidden");

      const { data: docStatus } = await svc
        .from("documents").select("status").eq("id", documentId).maybeSingle();
      if (docStatus?.status !== "ready") {
        throw new AppError("validation_failed", "Document must be fully processed before preparing inventory.");
      }

      const { data: version } = await svc
        .from("source_versions")
        .select("id")
        .eq("document_id", documentId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!version) {
        throw new AppError("validation_failed", "Source version not found. Re-process the document.");
      }

      const { data: chunks } = await svc
        .from("document_chunks")
        .select("id, content, page_no, char_start, char_end")
        .eq("document_id", documentId)
        .order("chunk_index")
        .limit(15);

      if (!chunks || chunks.length === 0) {
        throw new AppError("validation_failed", "No chunks found. The document has no readable content.");
      }

      const STARTER_CAP = 12;
      let unitsCreated = 0;
      let requestsCreated = 0;

      for (const chunk of chunks.slice(0, STARTER_CAP)) {
        const statement = chunk.content.slice(0, 200).replace(/\n/g, " ").trim();
        const spanHash = await hashContent(`${chunk.id}:${chunk.char_start}:${chunk.char_end}`);

        const { data: existingUnit } = await svc
          .from("knowledge_units")
          .select("id")
          .eq("owner_id", userId)
          .eq("source_version_id", version.id)
          .eq("statement", statement)
          .maybeSingle();

        let unitId: string;
        if (existingUnit) {
          unitId = existingUnit.id;
        } else {
          const { data: unit, error: unitErr } = await svc
            .from("knowledge_units")
            .insert({
              owner_id: userId,
              owner_kind: "user",
              source_version_id: version.id,
              kind: "fact",
              statement,
              language: "en",
              status: "grounded",
              derivation_version: "e5.v1",
            })
            .select("id")
            .single();
          if (unitErr) throw new AppError("internal", undefined, unitErr);
          unitId = unit.id;

          await svc.from("knowledge_unit_spans").insert({
            knowledge_unit_id: unitId,
            document_chunk_id: chunk.id,
            page_no: chunk.page_no,
            char_start: chunk.char_start,
            char_end: chunk.char_end,
            span_hash: spanHash,
          });
          unitsCreated++;
        }

        const idempotencyKey = `starter:${userId}:${version.id}:${unitId}:flashcard`;
        const { data: existingReq } = await svc
          .from("generation_requests")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existingReq) continue;

        const { data: genReq, error: genErr } = await svc
          .from("generation_requests")
          .insert({
            owner_id: userId,
            owner_kind: "user",
            source_version_id: version.id,
            knowledge_unit_id: unitId,
            probe_goal: "starter",
            item_type: "flashcard",
            language: "en",
            policy_version: "e5.v1",
            reason: "starter",
            status: "pending",
            idempotency_key: idempotencyKey,
          })
          .select("id")
          .single();
        if (genErr) throw new AppError("internal", undefined, genErr);

        await enqueue(svc, "generate_candidate", {
          key: `generate_candidate:${genReq.id}`,
          payload: { generation_request_id: genReq.id },
          traceId,
        });
        requestsCreated++;
      }

      log.info("ingest.prepare", {
        document_id: documentId,
        version_id: version.id,
        units_created: unitsCreated,
        requests_created: requestsCreated,
      });

      return json({
        ok: true,
        version_id: version.id,
        units_created: unitsCreated,
        requests_created: requestsCreated,
        trace_id: traceId,
      });
    }

    throw new AppError("validation_failed", "Unknown action.");
  }),
);

async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}