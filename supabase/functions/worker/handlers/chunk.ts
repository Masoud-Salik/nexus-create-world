/**
 * E4 / M4.4 — chunk a document's extracted pages.
 *
 * Idempotent by construction: chunking is deterministic and rows are upserted on
 * `(document_id, chunk_index)`, so a reclaimed lease rewrites the same rows.
 */
import { Job, JobContext, enqueue } from "../../_shared/queue.ts";
import { chunkPages } from "../../_shared/ingest/chunk.ts";

export async function chunkHandler(job: Job, ctx: JobContext): Promise<void> {
  const documentId = String(job.payload.document_id ?? "");
  if (!documentId) throw new Error("chunk: missing document_id");
  const { svc, log, traceId } = ctx;

  const { data: doc, error: docErr } = await svc
    .from("documents").select("id, user_id").eq("id", documentId).maybeSingle();
  if (docErr) throw new Error(`chunk: ${docErr.message}`);
  if (!doc) return;

  await svc.from("documents").update({ status: "chunking" }).eq("id", documentId);

  const { data: pages, error: pagesErr } = await svc
    .from("document_pages").select("page_no, text").eq("document_id", documentId).order("page_no");
  if (pagesErr) throw new Error(`chunk: ${pagesErr.message}`);

  const chunks = chunkPages((pages ?? []).map((p: any) => ({ page_no: p.page_no, text: p.text ?? "" })));

  if (!chunks.length) {
    await svc.from("documents")
      .update({ status: "failed", error: "No readable text could be extracted from this file." })
      .eq("id", documentId);
    log.warn("chunk.empty", { document_id: documentId });
    return;
  }

  // Drop chunks beyond the new count first, so a re-run after an edit cannot
  // leave orphaned tail rows behind.
  await svc.from("document_chunks").delete()
    .eq("document_id", documentId).gte("chunk_index", chunks.length);

  for (let i = 0; i < chunks.length; i += 200) {
    const batch = chunks.slice(i, i + 200).map((c) => ({
      ...c,
      document_id: documentId,
      user_id: doc.user_id,
      embedding: null,
      model_version: null,
    }));
    const { error } = await svc.from("document_chunks")
      .upsert(batch, { onConflict: "document_id,chunk_index" });
    if (error) throw new Error(`chunk: ${error.message}`);
  }

  await svc.from("documents")
    .update({ chunk_count: chunks.length, status: "embedding", error: null })
    .eq("id", documentId);

  await enqueue(svc, "embed", {
    key: `embed:${documentId}`,
    payload: { document_id: documentId },
    traceId,
  });
  log.info("chunk.done", { document_id: documentId, chunks: chunks.length });
}