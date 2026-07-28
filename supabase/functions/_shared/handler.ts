/**
 * E1 / M1.5 — the standard request wrapper.
 *
 * Handles CORS preflight, trace ids, structured request/response logging and the
 * error envelope so no individual service reimplements them (and leaks raw errors).
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AppError, errorResponse } from "./errors.ts";
import { createLogger, Logger, traceIdFrom } from "./logging.ts";

export interface Ctx {
  req: Request;
  log: Logger;
  traceId: string;
  url: URL;
  /** Value of the `Idempotency-Key` header, when present. */
  idempotencyKey: string | null;
}

export function serve(service: string, handler: (ctx: Ctx) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const traceId = traceIdFrom(req);
    const url = new URL(req.url);
    const log = createLogger(service, traceId, { method: req.method, path: url.pathname });

    try {
      const res = await handler({
        req,
        log,
        traceId,
        url,
        idempotencyKey: req.headers.get("idempotency-key"),
      });
      log.info("request.ok", { status: res.status, duration_ms: log.elapsedMs() });
      res.headers.set("X-Trace-Id", traceId);
      return res;
    } catch (err) {
      const known = err instanceof AppError;
      log.error("request.failed", {
        duration_ms: log.elapsedMs(),
        code: known ? (err as AppError).code : "internal",
        detail: known ? (err as AppError).detail : String(err),
      });
      return errorResponse(err, traceId);
    }
  };
}

/** Require the `Idempotency-Key` header on state-mutating requests. */
export function requireIdempotencyKey(ctx: Ctx): string {
  if (!ctx.idempotencyKey || ctx.idempotencyKey.length < 8 || ctx.idempotencyKey.length > 128) {
    throw new AppError("validation_failed", "A valid Idempotency-Key header is required.");
  }
  return ctx.idempotencyKey;
}