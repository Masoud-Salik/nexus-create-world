/**
 * E2 / M2.1 — the queue client.
 *
 * Thin, typed wrappers over the `jobs` SQL functions. Every handler registered
 * with the worker MUST be idempotent: a lease can expire mid-flight and the job
 * will be claimed again.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Logger } from "./logging.ts";

export type JobStatus = "pending" | "running" | "done" | "failed" | "dead";

export interface Job {
  id: string;
  kind: string;
  key: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  lease_until: string | null;
  next_run_at: string;
  last_error: string | null;
  trace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobContext {
  log: Logger;
  svc: SupabaseClient;
  /** The trace id the job was enqueued with, so the causal chain stays linked. */
  traceId: string;
}

/**
 * Handler contract. Must be idempotent and must throw on failure — the worker
 * translates a throw into `fail_job` (backoff or dead-letter).
 */
export type JobHandler = (job: Job, ctx: JobContext) => Promise<void>;

export interface EnqueueOptions {
  /** Stable logical identity. Re-enqueueing the same key is a no-op. */
  key: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
  traceId?: string;
}

export async function enqueue(
  svc: SupabaseClient,
  kind: string,
  opts: EnqueueOptions,
): Promise<string> {
  const { data, error } = await svc.rpc("enqueue_job", {
    _kind: kind,
    _key: opts.key,
    _payload: opts.payload ?? {},
    _run_at: (opts.runAt ?? new Date()).toISOString(),
    _max_attempts: opts.maxAttempts ?? 5,
    _trace_id: opts.traceId ?? null,
  });
  if (error) throw new Error(`enqueue_job failed: ${error.message}`);
  return data as string;
}

export async function claim(
  svc: SupabaseClient,
  kind: string | null,
  n: number,
  leaseSeconds: number,
): Promise<Job[]> {
  const { data, error } = await svc.rpc("claim_jobs", {
    _kind: kind,
    _n: n,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`claim_jobs failed: ${error.message}`);
  return (data ?? []) as Job[];
}

export async function complete(svc: SupabaseClient, id: string): Promise<void> {
  const { error } = await svc.rpc("complete_job", { _id: id });
  if (error) throw new Error(`complete_job failed: ${error.message}`);
}

/** Returns the resulting status: `pending` (will retry) or `dead` (dead-lettered). */
export async function fail(
  svc: SupabaseClient,
  id: string,
  message: string,
): Promise<JobStatus | null> {
  const { data, error } = await svc.rpc("fail_job", { _id: id, _error: message });
  if (error) throw new Error(`fail_job failed: ${error.message}`);
  return (data as JobStatus) ?? null;
}