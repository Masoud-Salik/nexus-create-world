// E3 / M3.2 — migrated onto the shared AI boundary. No direct provider calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyProviderKey } from "../_shared/ai/call.ts";
import { createLogger, traceIdFrom } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-trace-id",
};

async function getEncKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-key";
  const data = new TextEncoder().encode("studytime-openai-key:" + secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const buf = new Uint8Array(iv.length + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...buf));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = traceIdFrom(req);
  const log = createLogger("connect-openai", traceId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const apiKey = (body?.apiKey || "").toString().trim();

    // Validate format
    if (!apiKey || apiKey.length < 20 || apiKey.length > 200 || !apiKey.startsWith("sk-")) {
      return new Response(JSON.stringify({ error: "Invalid API key format. OpenAI keys start with 'sk-'." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify against OpenAI via the shared boundary
    const verification = await verifyProviderKey("openai", apiKey, traceId);

    if (!verification.ok) {
      const status = verification.status;
      let msg = "Could not verify your OpenAI key.";
      if (status === 401) msg = "Invalid API key. Double-check it on platform.openai.com.";
      else if (status === 429) msg = "Your OpenAI account is rate-limited or out of quota.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const availableModels: string[] = verification.models.filter((id: string) => /^gpt-/.test(id));

    const encrypted = await encrypt(apiKey);
    const last4 = apiKey.slice(-4);

    // Preserve existing preferences if row exists
    const { data: existing } = await supabase
      .from("user_ai_providers").select("selected_model, is_default")
      .eq("user_id", user.id).maybeSingle();

    const { error: upsertErr } = await supabase.from("user_ai_providers").upsert({
      user_id: user.id,
      provider: "openai",
      encrypted_api_key: encrypted,
      key_last4: last4,
      selected_model: existing?.selected_model || "gpt-5-mini",
      is_default: existing?.is_default ?? false,
      verified_at: new Date().toISOString(),
    });

    if (upsertErr) {
      log.error("upsert_failed", { detail: upsertErr.message });
      return new Response(JSON.stringify({ error: "Could not save your key. Try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, last4, models: availableModels.slice(0, 50) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log.error("request.failed", { detail: String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
