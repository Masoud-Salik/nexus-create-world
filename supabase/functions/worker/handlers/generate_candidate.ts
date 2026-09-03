/**
 * E5 — Generate an item candidate from a knowledge unit and its source spans.
 *
 * This handler is demand-driven: it picks up a generation_request, calls the
 * governed AI boundary to produce a candidate, and stores it in
 * `item_candidates` with status `pending`. Validation is a separate handler.
 *
 * Idempotent: if the request already has a non-expired candidate, the job
 * is a no-op. If the AI call fails, the job throws and the queue retries.
 */
import { Job, JobContext, enqueue } from "../../_shared/queue.ts";
import { callModel, fenceData, resolvePrompt } from "../../_shared/ai/call.ts";

const CANDIDATE_SYSTEM_PROMPT =
  "You generate study practice items from verified knowledge units and their " +
  "source spans. You receive a knowledge unit statement and the exact source " +
  "text that supports it. Produce ONE practice item that tests the learner on " +
  "that unit. The item must be answerable from the provided source text alone. " +
  "Do not introduce facts not present in the source. Return JSON only.";

const MAX_CANDIDATES_PER_REQUEST = 1;

interface GenerationRequest {
  id: string;
  owner_id: string;
  owner_kind: string;
  source_version_id: string;
  knowledge_unit_id: string;
  probe_goal: string | null;
  item_type: string;
  language: string;
  policy_version: string;
  reason: string;
}

export async function generateCandidateHandler(job: Job, ctx: JobContext): Promise<void> {
  const requestId = String(job.payload.generation_request_id ?? "");
  if (!requestId) throw new Error("generate_candidate: missing generation_request_id");
  const { svc, log, traceId } = ctx;

  const { data: req, error: reqErr } = await svc
    .from("generation_requests")
    .select("id, owner_id, owner_kind, source_version_id, knowledge_unit_id, probe_goal, item_type, language, policy_version, reason")
    .eq("id", requestId)
    .maybeSingle();
  if (reqErr) throw new Error(`generate_candidate: ${reqErr.message}`);
  if (!req) { log.warn("generate_candidate.request_not_found", { request_id: requestId }); return; }

  const typedReq = req as GenerationRequest;

  const { count: existingCount } = await svc
    .from("item_candidates")
    .select("id", { count: "exact", head: true })
    .eq("generation_request_id", requestId)
    .in("status", ["pending", "validating", "approved", "published"]);

  if ((existingCount ?? 0) >= MAX_CANDIDATES_PER_REQUEST) {
    log.info("generate_candidate.already_fulfilled", { request_id: requestId });
    return;
  }

  const { data: ku } = await svc
    .from("knowledge_units")
    .select("statement, kind, language")
    .eq("id", typedReq.knowledge_unit_id)
    .maybeSingle();

  const { data: spans } = await svc
    .from("knowledge_unit_spans")
    .select("document_chunk_id, page_no, char_start, char_end")
    .eq("knowledge_unit_id", typedReq.knowledge_unit_id);

  if (!ku?.statement) throw new Error("generate_candidate: knowledge unit has no statement");
  if (!spans || spans.length === 0) throw new Error("generate_candidate: knowledge unit has no source spans");

  const chunkIds = spans.map((s: any) => s.document_chunk_id).filter(Boolean);
  const { data: chunks } = await svc
    .from("document_chunks")
    .select("content, page_no, char_start, char_end")
    .in("id", chunkIds);

  const sourceText = (chunks ?? [])
    .map((c: any) => c.content)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);

  const aiCtx = { supabase: svc, ownerId: typedReq.owner_id, traceId, log };
  const prompted = await resolvePrompt(aiCtx, "generate_candidate", CANDIDATE_SYSTEM_PROMPT);

  const result = await callModel(
    "generate_candidate",
    {
      messages: [
        { role: "system", content: prompted.systemPrompt ?? CANDIDATE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: fenceData("source", sourceText) +
                `\n\nKnowledge unit: ${ku.statement}` +
                `\nItem type: ${typedReq.item_type}` +
                `\nLanguage: ${typedReq.language}` +
                (typedReq.probe_goal ? `\nProbe goal: ${typedReq.probe_goal}` : ""),
            },
          ],
        },
      ],
      extraBody: { prompt_version: prompted.promptVersion },
    },
    aiCtx,
  );

  const candidate = result.parsed as any;
  if (!candidate?.candidate) throw new Error("generate_candidate: AI returned no candidate");

  const payload = candidate.candidate;
  const contentHash = await hashContent(JSON.stringify(payload));

  const { data: inserted, error: insertErr } = await svc
    .from("item_candidates")
    .insert({
      owner_id: typedReq.owner_id,
      owner_kind: typedReq.owner_kind,
      generation_request_id: requestId,
      source_version_id: typedReq.source_version_id,
      knowledge_unit_id: typedReq.knowledge_unit_id,
      item_type: payload.item_type ?? typedReq.item_type,
      content_hash: contentHash,
      payload: payload,
      generator_model: result.model,
      prompt_version: prompted.promptVersion,
      schema_version: "e5.v1",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`generate_candidate: ${insertErr.message}`);

  await svc.from("generation_requests")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
    .eq("id", requestId);

  await enqueue(svc, "validate_candidate", {
    key: `validate_candidate:${inserted.id}`,
    payload: { candidate_id: inserted.id },
    traceId,
  });

  log.info("generate_candidate.done", {
    request_id: requestId,
    candidate_id: inserted.id,
    model: result.model,
  });
}

async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
