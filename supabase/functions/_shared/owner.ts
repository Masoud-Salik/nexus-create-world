/**
 * E1 / M1.3 — owner resolution.
 *
 * Blueprint v2's 90-second proof runs without an account, so every ingestion and
 * review row is owned by either an authenticated user or a short-lived anonymous
 * session. This module is the single place that decides which.
 *
 * Legacy tables (see docs/schema-audit.md) keep `user_id` and are always
 * `kind = "user"`; new Blueprint v2 tables carry `owner_id` + `owner_kind`.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./errors.ts";

export type OwnerKind = "user" | "anon";

export interface Owner {
  kind: OwnerKind;
  id: string;
}

export const ANON_HEADER = "x-anon-session";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve the caller. Prefers a valid JWT; falls back to an anonymous session
 * token when `allowAnon` is set. Throws `unauthorized` when neither is present.
 */
export async function resolveOwner(
  req: Request,
  opts: { allowAnon?: boolean } = {},
): Promise<Owner> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

  if (jwt) {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
    );
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) return { kind: "user", id: data.user.id };
  }

  if (opts.allowAnon) {
    const token = req.headers.get(ANON_HEADER);
    if (token) {
      const svc = serviceClient();
      const { data } = await svc
        .from("anon_sessions")
        .select("id, expires_at")
        .eq("token_hash", await hashToken(token))
        .maybeSingle();
      if (data && new Date(data.expires_at).getTime() > Date.now()) {
        return { kind: "anon", id: data.id };
      }
    }
  }

  throw new AppError("unauthorized");
}

/** Guard for endpoints that require a real account (no anonymous access). */
export function requireUser(owner: Owner): string {
  if (owner.kind !== "user") throw new AppError("forbidden", "Sign in to continue.");
  return owner.id;
}

export async function requireAdmin(owner: Owner): Promise<string> {
  const userId = requireUser(owner);
  const svc = serviceClient();
  const { data } = await svc.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new AppError("forbidden");
  return userId;
}