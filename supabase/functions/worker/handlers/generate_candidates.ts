/**
 * E5 Phase C — candidate generation.
 *
 * Serves both the bounded starter batch and lazy top-ups; the difference is
 * only the `generation_requests` row. Model output lands in `item_candidates`
 * and nowhere else — nothing here is learner-visible.
 */
import { Job, JobContext, enqueue } from "../../_shared/queue.ts";
import { callModel } from "../../_shared/ai/call.ts";
import { fenceData } from "../../_shared/ai/untrusted.ts";
import { contentHash } from "../../_shared/knowledge/units.ts";
import { emitEvent } from "../../_shared/knowledge/events.ts";

const MAX_UNITS = 15;

/** Item type → the deterministic grader it is published with. */
const GRADER_FOR: Record<string, string> = {
  flashcard: "normalized",
  mcq: "exact",
  true_false: "exact",
  fill_blank: "normalized",
  short_answer: "normalized",
  numeric: "numeric",
};

const SYSTEM = [
  "You write retrieval-practice items strictly grounded in the supplied source units.",
  "Each item MUST include `quote`: a VERBATIM substring of the cited chunk that supports the answer.",
  "Never put the answer inside the prompt. MCQs need exactly one correct option and 3-5 options total.",
  "Fill-in-the-blank prompts must contain a ___ gap. Keep answers short and checkable.",
  "Return JSON: {\"items\":[{\"item_type\",\"prompt\",\"answer\",\"options\",\"explanation\",\"quote\",\"chunk_index\"}]}",
].join(" ");

export async function generateCandidatesHandler(job: Job, ctx: JobContext): Promise<void> {
  const requestId = String(job.payload.request_id ?? "");
  if (!requestId) throw new Error("generate_candidates: missing request_id");
  const { svc, log, traceId } = ctx;

  const { data: request, error: reqErr } = await svc
    .from("generation_requests").select("*").eq("id", requestId).maybeSingle();
  if (reqErr) throw new Error(`generate_candidates: ${reqErr.message}`);
  if (!request) return;
  if (["done", "cancelled", "failed"].includes(request.status)) return;

  await svc.from("generation_requests").update({ status: "running" }).eq("id", requestId);

  // Units to cover, with the chunk each one is grounded in.
  let unitQuery = svc.from("knowledge_units")
    .select("id, statement, kind, knowledge_unit_spans(chunk_id, quote, page_no)")
    .eq("owner_id", request.owner_id)
    .eq("lifecycle", "grounded")
    .limit(MAX_UNITS);
  unitQuery = request.knowledge_unit_id
    ? unitQuery.eq("id", request.knowledge_unit_id)
    : unitQuery.eq("document_id", request.document_id);

  const { data: units, error: unitErr } = await unitQuery;
  if (unitErr) throw new Error(`generate_candidates: ${unitErr.message}`);
  if (!units || units.length === 0) {
    await svc.from("generation_requests")
      .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", requestId);
    return;
  }

  const chunkIds = [...new Set(units.flatMap((u: any) => (u.knowledge_unit_spans ?? []).map((s: any) => s.chunk_id)).filter(Boolean))];
  const { data: chunks, error: chunkErr } = await svc
    .from("document_chunks").select("id, chunk_index, content, page_no").in("id", chunkIds);
  if (chunkErr) throw new Error(`generate_candidates: ${chunkErr.message}`);
  const chunkById = new Map<string, any>((chunks ?? []).map((c: any) => [c.id, c]));

  const brief = units.map((u: any) => {
    const span = (u.knowledge_unit_spans ?? [])[0];
    const chunk = span ? chunkById.get(span.chunk_id) : null;
    return chunk
      ? `[chunk ${chunk.chunk_index}] unit: ${u.statement}\nsource: ${String(chunk.content).slice(0, 1200)}`
      : null;
  }).filter(Boolean).join("\n\n");
  if (!brief) {
    await svc.from("generation_requests")
      .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", requestId);
    return;
  }

  const result = await callModel<{ items: any[] }>("generate_candidates", {
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: fenceData(`Write ${request.requested_count} items covering these units.\n\n${brief}`),
      },
    ],
    schemaKey: "item_candidates",
  }, { supabase: svc, ownerId: request.owner_id, traceId, log });

  const chunkByIndex = new Map<number, any>((chunks ?? []).map((c: any) => [c.chunk_index, c]));
  const unitForChunk = new Map<string, string>();
  for (const u of units as any[]) {
    for (const s of u.knowledge_unit_spans ?? []) if (s.chunk_id) unitForChunk.set(s.chunk_id, u.id);
  }

  let stored = 0;
  for (const item of (result.parsed?.items ?? []).slice(0, request.requested_count)) {
    const chunk = chunkByIndex.get(Number(item.chunk_index));
    if (!chunk) continue;

    const payload = {
      prompt: String(item.prompt),
      answer: { value: String(item.answer) },
      options: item.options ?? null,
      explanation: item.explanation ?? null,
      grade_method: GRADER_FOR[item.item_type] ?? "normalized",
      citation: { chunk_id: chunk.id, page_no: chunk.page_no, quote: String(item.quote ?? "") },
    };

    const hash = await contentHash([request.owner_id, item.item_type, payload.prompt]);
    const { data: row, error: insErr } = await svc.from("item_candidates").upsert({
      owner_id: request.owner_id,
      request_id: requestId,
      knowledge_unit_id: unitForChunk.get(chunk.id) ?? null,
      document_id: request.document_id,
      source_version: 1,
      item_type: item.item_type,
      payload,
      content_hash: hash,
      generator_model: result.model,
      prompt_version: result.promptVersion,
      status: "generated",
    }, { onConflict: "owner_id,content_hash", ignoreDuplicates: true })
      .select("id").maybeSingle();
    if (insErr) throw new Error(`generate_candidates: ${insErr.message}`);
    if (row) stored++;
  }

  await svc.from("generation_requests")
    .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", requestId);

  await emitEvent(svc, "item.candidate_generated", {
    aggregateType: "generation_request",
    aggregateId: requestId,
    ownerId: request.owner_id,
    payload: { stored, model: result.model },
    traceId,
  });

  log.info("generate_candidates.done", { request_id: requestId, stored });

  if (stored > 0) {
    await enqueue(svc, "validate_candidates", {
      key: `validate_candidates:${requestId}`,
      payload: { request_id: requestId },
      traceId,
    });
  }
}
