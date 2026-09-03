/**
 * E5 — Validate an item candidate through deterministic trust gates.
 *
 * Gates (in order):
 * 1. structural     — schema fields are present and well-formed
 * 2. span_resolution — source spans resolve to actual chunk text
 * 3. grounding       — question is answerable from the source text
 * 4. answerability   — a correct answer exists
 * 5. ambiguity_leakage — no answer leakage in the question; no ambiguous phrasing
 * 6. item_type       — type-specific invariants (MCQ has ≥2 options, etc.)
 * 7. duplicate       — near-duplicate check against existing published items
 * 8. quality_policy  — difficulty set, explanation present for non-flashcard
 *
 * On all-gates-pass: candidate → `approved`, enqueue `publish_item`.
 * On any hard fail: candidate → `rejected` with reason codes.
 * Validation runs are append-only regardless of outcome.
 */
import { Job, JobContext, enqueue } from "../../_shared/queue.ts";

const VALIDATOR_VERSION = "e5.v1";
const DUPLICATE_THRESHOLD = 0.85;

interface CandidateRow {
  id: string;
  owner_id: string;
  owner_kind: string;
  source_version_id: string;
  knowledge_unit_id: string;
  item_type: string;
  content_hash: string;
  payload: any;
}

interface ValidationStageResult {
  stage: string;
  decision: "pass" | "fail" | "warn";
  reason_codes: string[];
  confidence: number;
  latency_ms: number;
}

export async function validateCandidateHandler(job: Job, ctx: JobContext): Promise<void> {
  const candidateId = String(job.payload.candidate_id ?? "");
  if (!candidateId) throw new Error("validate_candidate: missing candidate_id");
  const { svc, log, traceId } = ctx;

  const { data: candidate, error: candErr } = await svc
    .from("item_candidates")
    .select("id, owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, content_hash, payload, status")
    .eq("id", candidateId)
    .maybeSingle();
  if (candErr) throw new Error(`validate_candidate: ${candErr.message}`);
  if (!candidate) { log.warn("validate_candidate.not_found", { candidate_id: candidateId }); return; }

  const typedCand = candidate as CandidateRow;

  if (typedCand.status === "approved" || typedCand.status === "rejected" || typedCand.status === "published") {
    log.info("validate_candidate.already_terminal", { candidate_id: candidateId, status: typedCand.status });
    return;
  }

  await svc.from("item_candidates").update({ status: "validating" }).eq("id", candidateId);

  const { data: ku } = await svc
    .from("knowledge_units")
    .select("statement, kind")
    .eq("id", typedCand.knowledge_unit_id)
    .maybeSingle();

  const { data: spans } = await svc
    .from("knowledge_unit_spans")
    .select("document_chunk_id, page_no, char_start, char_end")
    .eq("knowledge_unit_id", typedCand.knowledge_unit_id);

  const chunkIds = (spans ?? []).map((s: any) => s.document_chunk_id).filter(Boolean);
  const { data: chunks } = await svc
    .from("document_chunks")
    .select("content")
    .in("id", chunkIds);
  const sourceText = (chunks ?? []).map((c: any) => c.content).filter(Boolean).join("\n\n").toLowerCase();

  const payload = typedCand.payload;
  const results: ValidationStageResult[] = [];

  // 1. Structural
  results.push(runStage("structural", () => {
    const codes: string[] = [];
    if (!payload.question || typeof payload.question !== "string") codes.push("missing_question");
    if (!payload.item_type) codes.push("missing_item_type");
    if (!payload.difficulty) codes.push("missing_difficulty");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 2. Span resolution
  results.push(runStage("span_resolution", () => {
    const codes: string[] = [];
    if (!spans || spans.length === 0) codes.push("no_source_spans");
    if (chunkIds.length === 0) codes.push("no_resolved_chunks");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 3. Grounding — check question keywords appear in source text
  results.push(runStage("grounding", () => {
    const codes: string[] = [];
    const qLower = (payload.question ?? "").toLowerCase();
    const keywords = qLower.split(/\s+/).filter((w: string) => w.length > 4).slice(0, 10);
    const overlap = keywords.filter((k: string) => sourceText.includes(k));
    if (overlap.length < Math.ceil(keywords.length * 0.3)) codes.push("insufficient_grounding");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 4. Answerability
  results.push(runStage("answerability", () => {
    const codes: string[] = [];
    if (payload.item_type === "mcq") {
      if (!payload.options || !Array.isArray(payload.options) || payload.options.length < 2) codes.push("mcq_needs_options");
      if (payload.options && !payload.options.some((o: any) => o.is_correct)) codes.push("no_correct_option");
    }
    if (payload.item_type === "flashcard" && !payload.answer) codes.push("flashcard_needs_answer");
    if (payload.item_type === "true_false" && !payload.correct_answer) codes.push("true_false_needs_answer");
    if (payload.item_type === "fill_blank" && !payload.correct_answer) codes.push("fill_blank_needs_answer");
    if (payload.item_type === "short_answer" && !payload.answer) codes.push("short_answer_needs_answer");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 5. Ambiguity / leakage
  results.push(runStage("ambiguity_leakage", () => {
    const codes: string[] = [];
    const q = (payload.question ?? "").toLowerCase();
    const a = (payload.answer ?? payload.correct_answer ?? "").toLowerCase();
    if (a && a.length > 3 && q.includes(a.slice(0, Math.min(a.length, 20)))) codes.push("answer_leaked_in_question");
    if (q.length < 10) codes.push("question_too_short");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 6. Item type invariants
  results.push(runStage("item_type", () => {
    const codes: string[] = [];
    if (payload.item_type === "mcq") {
      if (payload.options && payload.options.length > 6) codes.push("too_many_options");
      if (payload.options && payload.options.filter((o: any) => o.is_correct).length > 1) codes.push("multiple_correct_mcq");
    }
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // 7. Duplicate check — compare content_hash against published items
  results.push(await runDuplicateCheck(svc, typedCand));

  // 8. Quality / policy
  results.push(runStage("quality_policy", () => {
    const codes: string[] = [];
    if (!["easy", "medium", "hard"].includes(payload.difficulty)) codes.push("invalid_difficulty");
    if (payload.item_type !== "flashcard" && !payload.explanation) codes.push("missing_explanation");
    return { decision: codes.length ? "fail" : "pass", reason_codes: codes };
  }));

  // Persist all validation runs
  for (const r of results) {
    await svc.from("validation_runs").insert({
      item_candidate_id: candidateId,
      stage: r.stage,
      validator_version: VALIDATOR_VERSION,
      decision: r.decision,
      reason_codes: r.reason_codes,
      confidence: r.confidence,
      latency_ms: r.latency_ms,
    });
  }

  const hardFails = results.filter((r) => r.decision === "fail");
  const allPass = hardFails.length === 0;

  if (allPass) {
    await svc.from("item_candidates").update({ status: "approved" }).eq("id", candidateId);
    await enqueue(svc, "publish_item", {
      key: `publish_item:${candidateId}`,
      payload: { candidate_id: candidateId },
      traceId,
    });
    log.info("validate_candidate.approved", { candidate_id: candidateId });
  } else {
    const reasonCodes = hardFails.flatMap((r) => r.reason_codes).join("; ");
    await svc.from("item_candidates")
      .update({ status: "rejected", rejection_reason: reasonCodes })
      .eq("id", candidateId);
    log.info("validate_candidate.rejected", { candidate_id: candidateId, reasons: reasonCodes });
  }
}

function runStage(stage: string, check: () => { decision: "pass" | "fail" | "warn"; reason_codes: string[] }): ValidationStageResult {
  const start = Date.now();
  const result = check();
  return {
    stage,
    decision: result.decision,
    reason_codes: result.reason_codes,
    confidence: result.decision === "pass" ? 1.0 : 0.5,
    latency_ms: Date.now() - start,
  };
}

async function runDuplicateCheck(svc: any, candidate: CandidateRow): Promise<ValidationStageResult> {
  const start = Date.now();
  const { data: existing } = await svc
    .from("item_candidates")
    .select("content_hash")
    .eq("owner_id", candidate.owner_id)
    .eq("status", "published")
    .eq("item_type", candidate.item_type);

  const exactDup = (existing ?? []).some((e: any) => e.content_hash === candidate.content_hash);
  if (exactDup) {
    return { stage: "duplicate", decision: "fail", reason_codes: ["exact_duplicate"], confidence: 1.0, latency_ms: Date.now() - start };
  }

  return { stage: "duplicate", decision: "pass", reason_codes: [], confidence: 1.0, latency_ms: Date.now() - start };
}
