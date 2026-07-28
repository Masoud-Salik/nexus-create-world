/**
 * E1 / M1.4 — account export and deletion.
 *
 *   POST   /export  -> queue a full export of the caller's own data
 *   DELETE /        -> permanently delete the caller's account and data
 *
 * Deletion is a first-class product feature in Blueprint v2, so it is a real hard
 * delete: auth user, owned rows, and storage objects. Export is offered first.
 */
import { serve, requireIdempotencyKey } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { resolveOwner, requireUser, serviceClient } from "../_shared/owner.ts";

/** Tables exported and deleted with the account, keyed by their owner column. */
const OWNED_TABLES: Array<[table: string, column: string]> = [
  ["profiles", "id"],
  ["study_subjects", "user_id"],
  ["study_sessions", "user_id"],
  ["study_tasks", "user_id"],
  ["conversations", "user_id"],
  ["messages", "user_id"],
  ["ai_memory", "user_id"],
  ["ai_message_feedback", "user_id"],
  ["user_insights", "user_id"],
  ["user_documents", "user_id"],
  ["feedback", "user_id"],
  ["goals", "user_id"],
  ["habits", "user_id"],
  ["weekly_goals", "user_id"],
  ["daily_activities", "user_id"],
  ["daily_checkins", "user_id"],
  ["leaderboard_opt_ins", "user_id"],
  ["friendships", "user_id"],
];

const STORAGE_BUCKETS = ["user-documents", "situation-photos", "avatars", "study-selfies"];

Deno.serve(
  serve("account", async (ctx) => {
    const { req, log } = ctx;
    const owner = await resolveOwner(req);
    const userId = requireUser(owner);
    const svc = serviceClient();

    if (req.method === "POST") {
      requireIdempotencyKey(ctx);

      const { data: existing } = await svc
        .from("account_exports")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) return json({ job_id: existing.id, status: "pending" });

      const payload: Record<string, unknown> = {};
      for (const [table, column] of OWNED_TABLES) {
        const { data } = await svc.from(table).select("*").eq(column, userId);
        payload[table] = data ?? [];
      }

      const path = `${userId}/export-${Date.now()}.json`;
      const upload = await svc.storage
        .from("user-documents")
        .upload(path, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), {
          upsert: true,
        });
      if (upload.error) throw new AppError("internal", undefined, upload.error);

      const { data: row, error } = await svc
        .from("account_exports")
        .insert({ user_id: userId, status: "ready", file_path: path, completed_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw new AppError("internal", undefined, error);

      const signed = await svc.storage.from("user-documents").createSignedUrl(path, 3600);
      log.info("account.export_requested", { export_id: row.id });
      return json({ job_id: row.id, status: "ready", download_url: signed.data?.signedUrl ?? null });
    }

    if (req.method === "DELETE") {
      requireIdempotencyKey(ctx);
      const body = await req.json().catch(() => ({}));
      if (body?.confirm !== true) {
        throw new AppError("validation_failed", "Deletion must be explicitly confirmed.");
      }

      for (const bucket of STORAGE_BUCKETS) {
        const { data: files } = await svc.storage.from(bucket).list(userId);
        if (files?.length) {
          await svc.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
        }
      }

      for (const [table, column] of OWNED_TABLES) {
        await svc.from(table).delete().eq(column, userId);
      }
      await svc.from("anon_sessions").delete().eq("claimed_by", userId);

      const { error } = await svc.auth.admin.deleteUser(userId);
      if (error) throw new AppError("internal", undefined, error);

      log.info("account.deleted", { user_id: userId });
      return new Response(null, { status: 204 });
    }

    throw new AppError("validation_failed", "Unsupported method.");
  }),
);