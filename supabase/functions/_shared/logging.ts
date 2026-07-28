/**
 * E1 / M1.5 — structured logging with a trace id that spans client -> service -> job.
 *
 * The client sends `X-Trace-Id`; jobs carry it in their payload. One id ties an
 * entire causal chain together across edge functions and queue handlers.
 */

export type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  traceId: string;
  child(fields: Record<string, unknown>): Logger;
  log(level: Level, msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Milliseconds since the logger was created — used for the latency SLOs. */
  elapsedMs(): number;
}

export function traceIdFrom(req: Request): string {
  const incoming = req.headers.get("x-trace-id");
  if (incoming && /^[a-zA-Z0-9-]{8,64}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function createLogger(
  service: string,
  traceId: string,
  base: Record<string, unknown> = {},
): Logger {
  const startedAt = Date.now();

  const emit = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      service,
      trace_id: traceId,
      msg,
      ...base,
      ...fields,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  const logger: Logger = {
    traceId,
    child: (fields) => createLogger(service, traceId, { ...base, ...fields }),
    log: emit,
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    elapsedMs: () => Date.now() - startedAt,
  };
  return logger;
}