/**
 * E5 Phase C — bounded inventory policy.
 *
 * Generation is demand-driven and capped per source version. Nothing in the
 * pipeline may create a generation request without passing through here, so the
 * cost of a document can never grow unbounded.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const POLICY_VERSION = "gen@1";

/** Starter batch created once, when a source becomes ready. */
export const STARTER_MIN = 8;
export const STARTER_MAX = 15;

/** Hard ceiling on published items per source version. */
export const ITEMS_PER_SOURCE_CAP = 120;

/** Hard ceiling on generation requests per source version. */
export const REQUESTS_PER_SOURCE_CAP = 12;

/** Per-request model spend ceiling, written onto the request row. */
export const REQUEST_COST_CAP_USD = 0.05;

export type GenerationReason =
  | "starter" | "session_shortfall" | "misconception" | "coverage_gap" | "regeneration";

/** How many items to ask for, given existing inventory and what is needed. */
export function computeShortfall(needed: number, available: number, buffer = 5): number {
  const shortfall = Math.max(needed - available, 0);
  if (shortfall === 0) return 0;
  return Math.min(shortfall + buffer, STARTER_MAX);
}

export interface RequestInput {
  ownerId: string;
  documentId: string;
  reason: GenerationReason;
  requestedCount: number;
  knowledgeUnitId?: string | null;
  language?: string;
}

export interface RequestOutcome {
  requestId: string | null;
  /** Set when the request was refused; the caller must not generate. */
  blocked?: "items_cap" | "requests_cap" | "duplicate_pending" | "nothing_to_do";
}

/**
 * Create a generation request, or refuse it. Refusal is a normal outcome and is
 * never retried into a loop — the job completes without generating.
 */
export async function requestGeneration(
  svc: SupabaseClient,
  input: RequestInput,
): Promise<RequestOutcome> {
  if (input.requestedCount <= 0) return { requestId: null, blocked: "nothing_to_do" };

  const [{ count: itemCount }, { count: requestCount }, { count: pendingCount }] = await Promise.all([
    svc.from("items").select("id", { count: "exact", head: true })
      .eq("owner_id", input.ownerId).eq("document_id", input.documentId).eq("lifecycle", "active"),
    svc.from("generation_requests").select("id", { count: "exact", head: true })
      .eq("owner_id", input.ownerId).eq("document_id", input.documentId),
    svc.from("generation_requests").select("id", { count: "exact", head: true })
      .eq("owner_id", input.ownerId).eq("document_id", input.documentId)
      .eq("reason", input.reason).in("status", ["pending", "running"]),
  ]);

  if ((itemCount ?? 0) >= ITEMS_PER_SOURCE_CAP) return { requestId: null, blocked: "items_cap" };
  if ((requestCount ?? 0) >= REQUESTS_PER_SOURCE_CAP) return { requestId: null, blocked: "requests_cap" };
  if ((pendingCount ?? 0) > 0) return { requestId: null, blocked: "duplicate_pending" };

  const headroom = ITEMS_PER_SOURCE_CAP - (itemCount ?? 0);
  const count = Math.min(input.requestedCount, headroom, STARTER_MAX);

  const { data, error } = await svc.from("generation_requests").insert({
    owner_id: input.ownerId,
    document_id: input.documentId,
    knowledge_unit_id: input.knowledgeUnitId ?? null,
    reason: input.reason,
    requested_count: count,
    language: input.language ?? "en",
    policy_version: POLICY_VERSION,
    status: "pending",
    cost_cap_usd: REQUEST_COST_CAP_USD,
  }).select("id").single();

  if (error) throw new Error(`requestGeneration: ${error.message}`);
  return { requestId: data.id as string };
}
