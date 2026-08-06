/**
 * E5 — the transactional domain-event outbox.
 *
 * Business events describe what happened; `jobs` remains the work queue. A
 * dispatcher turns undispatched events into idempotent jobs, so delivery is
 * at-least-once and every consumer needs a stable job key.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type DomainEventType =
  | "source.version_ready"
  | "knowledge.inventory_requested"
  | "knowledge.unit_activated"
  | "item.candidate_generated"
  | "item.validation_completed"
  | "item.published"
  | "item.quarantined"
  | "review.session_created"
  | "review.attempt_received"
  | "review.grade_committed"
  | "schedule.updated"
  | "knowledge.state_updated"
  | "inventory.low"
  | "coverage.gap_detected"
  | "source.version_superseded"
  | "policy.version_promoted";

export interface EmitOptions {
  aggregateType: string;
  aggregateId?: string | null;
  ownerId?: string | null;
  ownerKind?: "user" | "anon";
  payload?: Record<string, unknown>;
  traceId?: string | null;
  causationId?: string | null;
  correlationId?: string | null;
}

/** Payloads stay small — events carry references, never document text. */
const MAX_PAYLOAD_BYTES = 8 * 1024;

export async function emitEvent(
  svc: SupabaseClient,
  type: DomainEventType,
  opts: EmitOptions,
): Promise<string> {
  const payload = opts.payload ?? {};
  const encoded = JSON.stringify(payload);
  if (encoded.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`emitEvent: payload too large for ${type} (${encoded.length}b)`);
  }

  const { data, error } = await svc
    .from("domain_events")
    .insert({
      event_type: type,
      aggregate_type: opts.aggregateType,
      aggregate_id: opts.aggregateId ?? null,
      owner_id: opts.ownerId ?? null,
      owner_kind: opts.ownerKind ?? "user",
      payload,
      trace_id: opts.traceId ?? null,
      causation_id: opts.causationId ?? null,
      correlation_id: opts.correlationId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`emitEvent: ${error.message}`);
  return data.id as string;
}