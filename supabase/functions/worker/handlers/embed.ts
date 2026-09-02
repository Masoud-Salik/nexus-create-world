/**
 * E4 / M4.4 — embed a document's chunks.
 *
 * Only rows with a NULL embedding are processed, so a reclaimed lease resumes
 * where the previous attempt stopped instead of re-paying for finished work.
 */
import { Job, JobContext } from "../../_shared/queue.ts";
import { embed } from "../../_shared/ai/call.ts";

const BATCH = 64;
const DIMS = 1536;
const MODEL_VERSION = "openai/text-embedding-3-small@1536";

export async function embedHandler(job: Job, ctx: JobContext): Promise<void> {
  const documentId = String(job.payload.document_id ?? "");
  if (!documentId) throw new Error("embed: missing document_id");
  const { svc, log, traceId } = ctx;

  const { data: doc, error: docErr } = await svc
    .from("documents").select("id, user_id").eq("id", documentId).maybeSingle();
  if (docErr) throw new Error(`embed: ${docErr.message}`);
  if (!doc) return;

  const aiCtx = { supabase: svc, ownerId: doc.user_id, traceId, log };

  for (;;) {
    const { data: pending, error } = await svc
      .from("document_chunks")
      .select("id, content")
      .eq("document_id", documentId)
      .is("embedding", null)
      .order("chunk_index")
      .limit(BATCH);
    if (error) throw new Error(`embed: ${error.message}`);
    if (!pending || pending.length === 0) break;

    const vectors = await embed(pending.map((c: any) => c.content), aiCtx, DIMS, "doc_embeddings");
    if (vectors.length !== pending.length) {
      throw new Error(`embed: provider returned ${vectors.length} vectors for ${pending.length} inputs`);
    }

    for (let i = 0; i < pending.length; i++) {
      const { error: upErr } = await svc.from("document_chunks")
        .update({ embedding: vectors[i], model_version: MODEL_VERSION })
        .eq("id", pending[i].id);
      if (upErr) throw new Error(`embed: ${upErr.message}`);
    }
  }

  await svc.from("documents").update({ status: "ready", error: null }).eq("id", documentId);

  // Knowledge Engine (E5): no eager item generation. Source readiness triggers
  // bounded knowledge-unit extraction, which requests a small starter batch.
  await enqueue(svc, "extract_units", {
    key: `extract_units:${documentId}:v1`,
    payload: { document_id: documentId },
    traceId,
  });

  log.info("embed.done", { document_id: documentId, eager_generation: false });
}
