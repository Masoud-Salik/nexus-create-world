/**
 * E5 — Publish an approved candidate as an immutable item version.
 *
 * Creates:
 * 1. An `items` row (stable semantic identity, lifecycle = active)
 * 2. An `item_versions` row (immutable wording, answer, rubric, provenance)
 * 3. `item_version_spans` rows (exact citations from the knowledge unit spans)
 *
 * Then marks the candidate as `published`. This is the ONLY path from AI
 * output to learner-visible content. The candidate row is retained for audit
 * but is no longer actionable.
 *
 * Idempotent: if the candidate is already `published`, the job is a no-op.
 */
import { Job, JobContext } from "../../_shared/queue.ts";

interface CandidateRow {
  id: string;
  owner_id: string;
  owner_kind: string;
  source_version_id: string;
  knowledge_unit_id: string;
  item_type: string;
  payload: any;
  generator_model: string | null;
  prompt_version: string | null;
  schema_version: string | null;
  status: string;
}

export async function publishItemHandler(job: Job, ctx: JobContext): Promise<void> {
  const candidateId = String(job.payload.candidate_id ?? "");
  if (!candidateId) throw new Error("publish_item: missing candidate_id");
  const { svc, log } = ctx;

  const { data: candidate, error: candErr } = await svc
    .from("item_candidates")
    .select("id, owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, payload, generator_model, prompt_version, schema_version, status")
    .eq("id", candidateId)
    .maybeSingle();
  if (candErr) throw new Error(`publish_item: ${candErr.message}`);
  if (!candidate) { log.warn("publish_item.not_found", { candidate_id: candidateId }); return; }

  const typedCand = candidate as CandidateRow;

  if (typedCand.status === "published") {
    log.info("publish_item.already_published", { candidate_id: candidateId });
    return;
  }
  if (typedCand.status !== "approved") {
    throw new Error(`publish_item: candidate is ${typedCand.status}, not approved`);
  }

  const payload = typedCand.payload;

  const { data: item, error: itemErr } = await svc
    .from("items")
    .insert({
      owner_id: typedCand.owner_id,
      owner_kind: typedCand.owner_kind,
      knowledge_unit_id: typedCand.knowledge_unit_id,
      item_type: payload.item_type ?? typedCand.item_type,
      lifecycle: "active",
      source_version_id: typedCand.source_version_id,
    })
    .select("id")
    .single();
  if (itemErr) throw new Error(`publish_item: items insert: ${itemErr.message}`);

  const { data: version, error: versionErr } = await svc
    .from("item_versions")
    .insert({
      item_id: item.id,
      version_no: 1,
      item_type: payload.item_type ?? typedCand.item_type,
      question: payload.question,
      answer: payload.answer ?? null,
      options: payload.options ?? null,
      correct_answer: payload.correct_answer ?? null,
      explanation: payload.explanation ?? null,
      difficulty: payload.difficulty ?? "medium",
      rubric: payload.rubric ?? null,
      policy_version: "e5.v1",
      generator_model: typedCand.generator_model,
      prompt_version: typedCand.prompt_version,
      schema_version: typedCand.schema_version,
      validation_policy_version: "e5.v1",
      source_version_id: typedCand.source_version_id,
    })
    .select("id")
    .single();
  if (versionErr) throw new Error(`publish_item: item_versions insert: ${versionErr.message}`);

  const { data: spans } = await svc
    .from("knowledge_unit_spans")
    .select("document_chunk_id, page_no, char_start, char_end, span_hash")
    .eq("knowledge_unit_id", typedCand.knowledge_unit_id);

  if (spans && spans.length > 0) {
    const spanRows = spans.map((s: any) => ({
      item_version_id: version.id,
      document_chunk_id: s.document_chunk_id,
      page_no: s.page_no,
      char_start: s.char_start,
      char_end: s.char_end,
      span_hash: s.span_hash,
      role: "support",
    }));
    const { error: spanErr } = await svc.from("item_version_spans").insert(spanRows);
    if (spanErr) throw new Error(`publish_item: spans insert: ${spanErr.message}`);
  }

  await svc.from("item_candidates").update({ status: "published" }).eq("id", candidateId);

  log.info("publish_item.done", {
    candidate_id: candidateId,
    item_id: item.id,
    item_version_id: version.id,
  });
}
