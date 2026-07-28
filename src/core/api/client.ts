/**
 * E1 / M1.5 — the single API client.
 *
 * Responsibilities: attach auth (user JWT or guest token), attach trace and
 * idempotency headers, and normalise every failure into an `ApiError`. Feature
 * modules never call `fetch` or `functions.invoke` directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { ApiError, ApiErrorCode } from "./errors";
import { newIdempotencyKey, newTraceId } from "@/core/telemetry/trace";
import { readAnonSession } from "@/core/auth/anonSession";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  /** Set for state-mutating calls; a stable key makes retries safe. */
  idempotencyKey?: string;
  traceId?: string;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  const traceId = options.traceId ?? newTraceId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Trace-Id": traceId,
  };

  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  } else {
    const guest = readAnonSession();
    if (guest) headers["x-anon-session"] = guest.token;
  }

  if (method !== "GET") {
    headers["Idempotency-Key"] = options.idempotencyKey ?? newIdempotencyKey();
  }

  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    throw new ApiError("network", "Network request failed.", traceId);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const code = (payload?.code as ApiErrorCode) ?? "internal";
    throw new ApiError(
      code,
      payload?.message ?? "Request failed.",
      payload?.trace_id ?? traceId,
      response.status,
    );
  }

  return payload as T;
}