/**
 * E2 / M2.1 — transactional outbox.
 *
 * Enqueueing over PostgREST is a separate round-trip from the write it
 * accompanies, so a crash in between loses the job. Services that must not lose
 * follow-up work call `outbox_enqueue` from inside the same SQL function as their
 * write; this helper is the client-side entry point for that RPC.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function outboxEnqueue(
  svc: SupabaseClient,
  kind: string,
  key: string,
  payload: Record<string, unknown> = {},
  traceId?: string,
): Promise<string> {
  const { data, error } = await svc.rpc("outbox_enqueue", {
    _kind: kind,
    _key: key,
    _payload: payload,
    _trace_id: traceId ?? null,
  });
  if (error) throw new Error(`outbox_enqueue failed: ${error.message}`);
  return data as string;
}