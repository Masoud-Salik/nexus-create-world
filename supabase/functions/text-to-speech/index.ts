// E3 / M3.1 — migrated onto the shared AI boundary. No direct provider calls.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AiLimitError, ProviderError, speak } from "../_shared/ai/call.ts";
import { createLogger, traceIdFrom } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = traceIdFrom(req);
  const log = createLogger("text-to-speech", traceId);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: "Text too long (max 4000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiCtx = { supabase, ownerId: user.id, traceId, log };

    try {
      const audioData = await speak(text, aiCtx, { voice: "nova", speed: 0.95, format: "mp3" });
      return new Response(audioData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Content-Length": audioData.byteLength.toString(),
          "X-Trace-Id": traceId,
        },
      });
    } catch (e) {
      if (e instanceof AiLimitError) {
        return new Response(
          JSON.stringify({ code: "rate_limited", message: "Too many requests. Try again shortly.", trace_id: traceId }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (e instanceof ProviderError) {
        if (e.status === 429) {
          return new Response(
            JSON.stringify({ code: "rate_limited", message: "Too many requests. Try again shortly.", trace_id: traceId }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (e.status === 402) {
          return new Response(
            JSON.stringify({ code: "payment_required", message: "AI credits exhausted.", trace_id: traceId }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      log.error("tts.failed", { detail: String(e) });
      return new Response(
        JSON.stringify({ code: "internal", message: "Text-to-speech request failed.", trace_id: traceId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    log.error("request.failed", { detail: String(error) });
    return new Response(
      JSON.stringify({ code: "internal", message: "Something went wrong on our side.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
