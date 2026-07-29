/**
 * E2 / M2.3 — `GET /v1/admin/queue`.
 *
 * Operator visibility into the durable queue: counts by kind and status, the age
 * of the oldest pending job, and the dead-letter list. Admin role only, and every
 * access is recorded in `admin_access_log`.
 */
import { serve } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { resolveOwner, requireAdmin, serviceClient } from "../_shared/owner.ts";

interface JobRow {
  kind: string;
  status: string;
  created_at: string;
  next_run_at: string;
}

Deno.serve(
  serve("admin-queue", async (ctx) => {
    const { req, log } = ctx;
    if (req.method !== "GET") throw new AppError("not_found");

    const owner = await resolveOwner(req);
    const adminId = await requireAdmin(owner);
    const svc = serviceClient();

    const { data: rows, error } = await svc
      .from("jobs")
      .select("kind, status, created_at, next_run_at")
      .limit(50_000);
    if (error) throw new AppError("internal", undefined, error);

    const byKindStatus: Record<string, Record<string, number>> = {};
    let oldestPendingAgeMs = 0;
    const now = Date.now();

    for (const row of (rows ?? []) as JobRow[]) {
      byKindStatus[row.kind] ??= {};
      byKindStatus[row.kind][row.status] = (byKindStatus[row.kind][row.status] ?? 0) + 1;
      if (row.status === "pending") {
        const age = now - new Date(row.created_at).getTime();
        if (age > oldestPendingAgeMs) oldestPendingAgeMs = age;
      }
    }

    const { data: dead } = await svc
      .from("jobs")
      .select("id, kind, key, attempts, last_error, created_at, updated_at")
      .eq("status", "dead")
      .order("updated_at", { ascending: false })
      .limit(50);

    await svc.from("admin_access_log").insert({
      admin_id: adminId,
      action: "queue.read",
      detail: { trace_id: ctx.traceId },
    });

    log.info("admin.queue_read", { kinds: Object.keys(byKindStatus).length });

    return json({
      by_kind: byKindStatus,
      oldest_pending_age_ms: oldestPendingAgeMs,
      dead_letter: dead ?? [],
    });
  }),
);