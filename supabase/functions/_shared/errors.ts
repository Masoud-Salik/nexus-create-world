/**
 * E1 / M1.5 — canonical error envelope.
 *
 * Every service returns `{ code, message, trace_id }`. Internal detail never
 * reaches the client; it goes to the structured log against the same trace id.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 400,
  conflict: 409,
  rate_limited: 429,
  quota_exceeded: 402,
  internal: 500,
};

const SAFE_MESSAGE: Record<ErrorCode, string> = {
  unauthorized: "Authentication required.",
  forbidden: "You do not have access to this resource.",
  not_found: "Not found.",
  validation_failed: "The request was invalid.",
  conflict: "The request conflicts with the current state.",
  rate_limited: "Too many requests. Try again shortly.",
  quota_exceeded: "Usage limit reached.",
  internal: "Something went wrong on our side.",
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly detail?: unknown,
  ) {
    super(message ?? SAFE_MESSAGE[code]);
    this.name = "AppError";
  }
}

export const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

export function errorResponse(err: unknown, traceId: string): Response {
  const appErr = err instanceof AppError ? err : new AppError("internal", undefined, err);
  return json(
    { code: appErr.code, message: appErr.message, trace_id: traceId },
    STATUS[appErr.code],
    { "X-Trace-Id": traceId },
  );
}