/**
 * E5 Phase C — validation and publication.
 *
 * Deterministic gates first (free, exhaustive), then an independent AI verifier
 * for grounding and entailment, and only then publication as an immutable item
 * version. Every decision is written to `validation_runs`.
 */
import { Job, JobContext } from "../../_shared/queue.ts";
import { callModel } from "../../_shared/ai/call.ts";
import { fenceData } from "../../_shared/ai/untrusted.ts";
import { runGates, VALIDATOR_VERSION } from "../../_shared/knowledge/validators.ts";
import { publishCandidate, quarantineCandidate } from "../../_shared/knowledge/publish.ts";
import { emitEvent } from "../../_shared/knowledge/events.ts";

const BATCH = 20;
const MIN_CONFIDENCE = 0.7;
const VERIFIER_VERSION = "verify@1";

const SYSTEM = [
  "You are an independent verifier of study items.",
  "Decide only two things from the SOURCE text: is the item grounded in it, and does the source entail the given answer?",
  "Do not use outside knowledge. If the source does not settle the answer, entailed is false.",
  "Return JSON: {\"grounded\":bool,\"entailed\":bool,\"confidence\":0..1,\"reason\":string}",
].join(" ");

async function record(
  svc: any,
  candidateId: string,
  ownerId: string,
  stage: string,
  version: string,
  decision: "pass" | "fail" | "warn",
  reasonCodes: string[],
  confidence?: number | null,
  latencyMs?: number,
) {
  await svc.from("validation_runs").insert({
    candidate_id: candidateId,
    owner_id: ownerId,
    stage,
    validator_version: version,
    decision,
    reason_codes: reasonCodes,
    confidence: confidence ?? null,
    latency_ms: latencyMs ?? null,
  });
}

export async function validateCandidatesHandler(job: Job, ctx: JobContext): Promise<void> {
  const requestId = String(job.payload.request_id ?? "");
  if (!requestId) throw new Error("validate_candidates: missing request_id");
  const { svc, log, traceId } = ctx;

  const { data: candidates, error } = await svc
    .from("item_candidates")
    .select("*")
    .eq("request_id", requestId)
    .in("status", ["generated", "validating"])
    .limit(BATCH);
  if (error) throw new Error(`validate_candidates: ${error.message}`);
  if (!candidates || candidates.length === 0) return;

  let published = 0;
  let rejected = 0;

  for (const candidate of candidates as any[]) {
    const payload = candidate.payload ?? {};
    const chunkId = payload?.citation?.chunk_id ?? null;

    const { data: chunk } = chunkId
      ? await svc.from("document_chunks").select("id, content, page_no").eq("id", chunkId).maybeSingle()
      : { data: null };

    // Already-published prompts guard the near-duplicate gate.
    const { data: existing } = await svc.from("item_versions")
      .select("prompt").eq("owner_id", candidate.owner_id).limit(200);

    const gate = runGates({
      item_type: candidate.item_type,
      prompt: payload.prompt,
      answer: payload.answer ?? {},
      options: payload.options,
      explanation: payload.explanation,
      grade_method: payload.grade_method,
      citation: { chunk_id: chunkId, quote: payload?.citation?.quote ?? "" },
    }, {
      chunkText: String(chunk?.content ?? ""),
      existingPrompts: (existing ?? []).map((r: any) => r.prompt),
    });

    await record(
      svc, candidate.id, candidate.owner_id, "deterministic",
      VALIDATOR_VERSION, gate.decision, gate.reasonCodes,
    );

    if (gate.decision === "fail" || !gate.span) {
      await quarantineCandidate(svc, candidate.id, candidate.owner_id, gate.reasonCodes, traceId);
      rejected++;
      continue;
    }

    // Independent grounding/entailment check — only for candidates that already passed.
    const startedAt = Date.now();
    let verdict = { grounded: false, entailed: false, confidence: 0, reason: "verifier_unavailable" };
    try {
      const res = await callModel<typeof verdict>("verify_item", {
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: fenceData(
              `SOURCE:\n${String(chunk?.content ?? "").slice(0, 2000)}\n\n` +
              `ITEM:\nprompt: ${payload.prompt}\nanswer: ${JSON.stringify(payload.answer)}`,
            ),
          },
        ],
        schemaKey: "item_verification",
        cacheInput: { hash: candidate.content_hash },
      }, { supabase: svc, ownerId: candidate.owner_id, traceId, log });
      if (res.parsed) verdict = res.parsed as typeof verdict;
    } catch (err) {
      // A verifier outage must never publish unverified content, and must never
      // burn the candidate either — leave it for the next run.
      log.warn("validate_candidates.verifier_failed", {
        candidate_id: candidate.id,
        detail: err instanceof Error ? err.message : String(err),
      });
      await record(
        svc, candidate.id, candidate.owner_id, "grounding", VERIFIER_VERSION,
        "warn", ["verifier_unavailable"], null, Date.now() - startedAt,
      );
      continue;
    }

    const passed = verdict.grounded && verdict.entailed && verdict.confidence >= MIN_CONFIDENCE;
    await record(
      svc, candidate.id, candidate.owner_id, "grounding", VERIFIER_VERSION,
      passed ? "pass" : "fail",
      passed ? [] : ["not_grounded"],
      verdict.confidence, Date.now() - startedAt,
    );

    if (!passed) {
      await quarantineCandidate(svc, candidate.id, candidate.owner_id, ["not_grounded"], traceId);
      rejected++;
      continue;
    }

    await svc.from("item_candidates").update({ status: "approved" })
      .eq("id", candidate.id).eq("status", "generated");

    const result = await publishCandidate(svc, {
      candidate,
      span: {
        chunk_id: chunkId,
        page_no: chunk?.page_no ?? null,
        char_start: gate.span.char_start,
        char_end: gate.span.char_end,
        quote: gate.span.quote,
      },
      traceId,
    });
    if (!result.alreadyPublished) published++;
  }

  await emitEvent(svc, "item.validation_completed", {
    aggregateType: "generation_request",
    aggregateId: requestId,
    ownerId: (candidates[0] as any).owner_id,
    payload: { published, rejected },
    traceId,
  });

  log.info("validate_candidates.done", { request_id: requestId, published, rejected });
}
