/**
 * E1 / M1.3 — anonymous identity.
 *
 *   POST /            -> mint a guest session (rate limited per IP)
 *   POST /claim       -> attach a guest session's data to the signed-in user
 *
 * Guest sessions exist so the Blueprint v2 "90-second proof" can ingest and review
 * before an account exists. They are short lived and garbage collected hourly.
 */
import { serve } from "../_shared/handler.ts";
import { AppError, json } from "../_shared/errors.ts";
import { hashToken, resolveOwner, requireUser, serviceClient } from "../_shared/owner.ts";

const TTL_MINUTES = 60;
const MAX_PER_IP_PER_HOUR = 5;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

Deno.serve(
  serve("anon", async ({ req, url, log }) => {
    if (req.method !== "POST") throw new AppError("validation_failed", "POST only.");
    const svc = serviceClient();

    if (url.pathname.endsWith("/claim")) {
      const owner = await resolveOwner(req);
      const userId = requireUser(owner);
      const body = await req.json().catch(() => ({}));
      const token = typeof body?.token === "string" ? body.token : "";
      if (!token) throw new AppError("validation_failed", "A guest session token is required.");

      const { data, error } = await svc
        .from("anon_sessions")
        .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
        .eq("token_hash", await hashToken(token))
        .is("claimed_by", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (error) throw new AppError("internal", undefined, error);
      if (!data) throw new AppError("conflict", "That guest session has expired or was already claimed.");

      log.info("anon.claimed", { anon_session_id: data.id });
      return json({ claimed: true, anon_session_id: data.id });
    }

    // Mint. Per-IP throttle keeps the unauthenticated, AI-backed surface bounded.
    const ip = clientIp(req);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await svc
      .from("anon_sessions")
      .select("id", { count: "exact", head: true })
      .eq("created_ip", ip)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) throw new AppError("rate_limited");

    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await svc
      .from("anon_sessions")
      .insert({ token_hash: await hashToken(token), expires_at: expiresAt, created_ip: ip })
      .select("id")
      .single();

    if (error) throw new AppError("internal", undefined, error);
    log.info("anon.minted", { anon_session_id: data.id });

    return json({ token, expires_at: expiresAt });
  }),
);