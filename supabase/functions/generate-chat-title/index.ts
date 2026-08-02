// E3 / M3.4 — migrated onto the shared AI boundary. No direct provider calls.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AiLimitError, callModel, resolvePrompt } from "../_shared/ai/call.ts";
import { serviceClient } from "../_shared/owner.ts";
import { createLogger, traceIdFrom } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id",
};

const SYSTEM_PROMPT =
  "You generate short, creative chat titles. Max 5 words. Be concise and catchy.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = traceIdFrom(req);
  const log = createLogger("generate-chat-title", traceId);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userMessage = typeof body?.userMessage === "string" ? body.userMessage.slice(0, 2000) : "";
    const assistantMessage = typeof body?.assistantMessage === "string" ? body.assistantMessage.slice(0, 2000) : "";

    const prompt = `Based on this conversation, generate a short, catchy title (max 5 words) that captures the topic. Return ONLY the title, nothing else.

User: ${userMessage}
Assistant: ${assistantMessage?.slice(0, 200) || ""}`;

    const ctx = { supabase: serviceClient(), ownerId: user.id, traceId, log };
    const prompted = await resolvePrompt(ctx, "generate_chat_title", SYSTEM_PROMPT);

    try {
      // Deterministic: identical conversations reuse the cached title.
      const result = await callModel("generate_chat_title", {
        messages: [
          { role: "system", content: prompted.systemPrompt ?? SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        cacheInput: { userMessage, assistantMessage: assistantMessage.slice(0, 200) },
        extraBody: { prompt_version: prompted.promptVersion },
      }, ctx);

      const title = result.text.trim().replace(/^["']|["']$/g, "") || null;
      return new Response(JSON.stringify({ title }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Trace-Id": traceId },
      });
    } catch (e) {
      if (e instanceof AiLimitError) {
        return new Response(
          JSON.stringify({ title: null, code: "rate_limited", message: "Too many requests. Try again shortly.", trace_id: traceId }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      log.error("title.failed", { detail: String(e) });
      return new Response(
        JSON.stringify({ title: null, error: "Failed to generate title" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    log.error("request.failed", { detail: String(e) });
    return new Response(
      JSON.stringify({ title: null, code: "internal", message: "Something went wrong on our side.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
