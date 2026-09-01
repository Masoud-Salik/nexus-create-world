/**
 * E5 Phase C — candidate publication.
 *
 * The only path from a temporary `item_candidates` row to durable, learner-
 * facing content. Publication is idempotent: the candidate row is claimed with
 * a conditional status update, so a replayed validation event can never create
 * a second item version.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { emitEvent } from "./events.ts";

export const PUBLISH_POLICY_VERSION = "pub@1";

export interface PublishInput {
  candidate: {
    id: string;
    owner_id: string;
    owner_kind?: string;
    document_id: string | null;
    knowledge_unit_id: string | null;
    source_version: number;
    item_type: string;
    payload: Record<string, any>;
  };
  span: { chunk_id?: string | null; page_no?: number | null; char_start: number; char_end: number; quote: string };
  traceId?: string | null;
}

export interface PublishResult {
  itemId: string | null;
  itemVersionId: string | null;
  /** True when another run already published this candidate. */
  alreadyPublished: boolean;
}

/** Claim the candidate. Returns false when someone else already published it. */
async function claimCandidate(svc: SupabaseClient, candidateId: string): Promise<boolean> {
  const { data, error } = await svc.from("item_candidates")
    .update({ status: "published" })
    .eq("id", candidateId)
    .eq("status", "approved")
    .select("id");
  if (error) throw new Error(`publish.claim: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function publishCandidate(
  svc: SupabaseClient,
  input: PublishInput,
): Promise<PublishResult> {
  const { candidate, span } = input;

  if (!(await claimCandidate(svc, candidate.id))) {
    return { itemId: null, itemVersionId: null, alreadyPublished: true };
  }

  const payload = candidate.payload ?? {};

  const { data: item, error: itemErr } = await svc.from("items").insert({
    owner_id: candidate.owner_id,
    owner_kind: candidate.owner_kind ?? "user",
    knowledge_unit_id: candidate.knowledge_unit_id,
    document_id: candidate.document_id,
    lifecycle: "active",
    active_version: 1,
  }).select("id").single();
  if (itemErr) throw new Error(`publish.item: ${itemErr.message}`);

  const { data: version, error: verErr } = await svc.from("item_versions").insert({
    item_id: item.id,
    owner_id: candidate.owner_id,
    version: 1,
    item_type: candidate.item_type,
    prompt: String(payload.prompt ?? ""),
    answer: payload.answer ?? {},
    rubric: payload.options ? { options: payload.options } : null,
    explanation: payload.explanation ?? null,
    grade_method: String(payload.grade_method ?? "normalized"),
    policy_version: PUBLISH_POLICY_VERSION,
  }).select("id").single();
  if (verErr) throw new Error(`publish.version: ${verErr.message}`);

  const { error: spanErr } = await svc.from("item_version_spans").insert({
    item_version_id: version.id,
    owner_id: candidate.owner_id,
    chunk_id: span.chunk_id ?? null,
    document_id: candidate.document_id,
    page_no: span.page_no ?? null,
    char_start: span.char_start,
    char_end: span.char_end,
    quote: span.quote,
    role: "question",
  });
  if (spanErr) throw new Error(`publish.span: ${spanErr.message}`);

  await emitEvent(svc, "item.published", {
    aggregateType: "item",
    aggregateId: item.id,
    ownerId: candidate.owner_id,
    payload: { item_version_id: version.id, candidate_id: candidate.id },
    traceId: input.traceId ?? null,
  });

  return { itemId: item.id, itemVersionId: version.id, alreadyPublished: false };
}

/** Terminal rejection. Quarantine keeps the reason for the admin sample queue. */
export async function quarantineCandidate(
  svc: SupabaseClient,
  candidateId: string,
  ownerId: string,
  reasonCodes: string[],
  traceId?: string | null,
): Promise<void> {
  const { error } = await svc.from("item_candidates")
    .update({ status: "rejected", rejection_reason: reasonCodes.join(",").slice(0, 500) })
    .eq("id", candidateId)
    .in("status", ["generated", "validating"]);
  if (error) throw new Error(`quarantine: ${error.message}`);

  await emitEvent(svc, "item.quarantined", {
    aggregateType: "item_candidate",
    aggregateId: candidateId,
    ownerId,
    payload: { reason_codes: reasonCodes },
    traceId: traceId ?? null,
  });
}
