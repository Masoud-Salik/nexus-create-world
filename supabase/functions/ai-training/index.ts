import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed } from "../_shared/ai/call.ts";
import { chunkPages } from "../_shared/ingest/chunk.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function requireAdmin(supabase: ReturnType<typeof createClient>, token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "unauthorized", status: 401 } as const;
  const { data: hasRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!hasRole) return { error: "forbidden", status: 403 } as const;
  return { user } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const gate = await requireAdmin(supabase, token);
    if ("error" in gate) {
      return new Response(JSON.stringify({ error: gate.error }), {
        status: gate.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = gate.user;

    const traceId = req.headers.get("X-Trace-Id") || crypto.randomUUID();
    const aiCtx = { supabase, ownerId: user.id, traceId };

    const { action, ...payload } = await req.json();

    if (action === "ingest_doc") {
      const title = String(payload.title || "Untitled").slice(0, 200);
      const content = String(payload.content || "").slice(0, 200_000);
      const sourceType = String(payload.source_type || "text").slice(0, 20);
      const sourceUrl = payload.source_url ? String(payload.source_url).slice(0, 500) : null;
      if (!content.trim()) {
        return new Response(JSON.stringify({ error: "content required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: doc, error: docErr } = await supabase
        .from("ai_knowledge_docs")
        .insert({
          title, source_type: sourceType, source_url: sourceUrl,
          status: "processing", created_by: user.id,
        })
        .select("id").single();
      if (docErr || !doc) {
        return new Response(JSON.stringify({ error: docErr?.message || "insert failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chunks = chunkPages([{ page_no: 0, text: content }]);
      try {
        const rows: any[] = [];
        for (let i = 0; i < chunks.length; i += 16) {
          const batch = chunks.slice(i, i + 16);
          const vecs = await embed(batch.map((c) => c.content), aiCtx, 768, "embeddings");
          if (vecs.length !== batch.length) {
            throw new Error(`embed: provider returned ${vecs.length} vectors for ${batch.length} inputs`);
          }
          batch.forEach((c, idx) => {
            rows.push({
              doc_id: doc.id,
              chunk_index: i + idx,
              content: c.content,
              embedding: vecs[idx],
              token_count: c.token_count,
            });
          });
        }
        for (let i = 0; i < rows.length; i += 100) {
          const { error } = await supabase.from("ai_knowledge_chunks").insert(rows.slice(i, i + 100));
          if (error) throw error;
        }
        await supabase.from("ai_knowledge_docs")
          .update({ status: "ready", chunk_count: rows.length, error_message: null })
          .eq("id", doc.id);
        return new Response(JSON.stringify({ success: true, doc_id: doc.id, chunks: rows.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        await supabase.from("ai_knowledge_docs")
          .update({ status: "failed", error_message: e instanceof Error ? e.message : "unknown" })
          .eq("id", doc.id);
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "ingest failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "delete_doc") {
      const id = String(payload.doc_id || "");
      if (!id) return new Response("missing doc_id", { status: 400, headers: corsHeaders });
      const { error } = await supabase.from("ai_knowledge_docs").delete().eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_search") {
      const query = String(payload.query || "").slice(0, 500);
      if (!query) return new Response("missing query", { status: 400, headers: corsHeaders });
      const [vec] = await embed(query, aiCtx, 768, "embeddings");
      const { data, error } = await supabase.rpc("match_knowledge", {
        query_embedding: vec, match_count: payload.top_k || 5,
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ results: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_prompt") {
      const row = {
        name: String(payload.name || "Untitled").slice(0, 100),
        system_prompt: String(payload.system_prompt || "").slice(0, 20000),
        persona: payload.persona ? String(payload.persona).slice(0, 50) : null,
        temperature: Number(payload.temperature ?? 0.7),
        max_tokens: Number(payload.max_tokens ?? 2048),
        tool_aggressiveness: String(payload.tool_aggressiveness || "balanced").slice(0, 20),
        few_shots: Array.isArray(payload.few_shots) ? payload.few_shots.slice(0, 10) : [],
        is_active: !!payload.activate,
        created_by: user.id,
      };
      if (row.is_active) {
        await supabase.from("ai_prompt_versions").update({ is_active: false }).eq("is_active", true);
      }
      const { data, error } = await supabase.from("ai_prompt_versions").insert(row).select("id").single();
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "activate_prompt") {
      const id = String(payload.id || "");
      if (!id) return new Response("missing id", { status: 400, headers: corsHeaders });
      await supabase.from("ai_prompt_versions").update({ is_active: false }).eq("is_active", true);
      const { error } = await supabase.from("ai_prompt_versions").update({ is_active: true }).eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_example") {
      const row = {
        source_message_id: payload.source_message_id || null,
        user_input: String(payload.user_input || "").slice(0, 4000),
        ideal_response: String(payload.ideal_response || "").slice(0, 8000),
        tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 8) : [],
        created_by: user.id,
      };
      if (!row.user_input || !row.ideal_response) {
        return new Response(JSON.stringify({ error: "user_input and ideal_response required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("ai_training_examples").insert(row);
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export_dataset") {
      const { data } = await supabase
        .from("ai_training_examples")
        .select("user_input, ideal_response, tags")
        .order("created_at", { ascending: false });
      const jsonl = (data || [])
        .map((r) => JSON.stringify({ messages: [
          { role: "user", content: r.user_input },
          { role: "assistant", content: r.ideal_response },
        ], tags: r.tags }))
        .join("\n");
      return new Response(jsonl, {
        headers: { ...corsHeaders, "Content-Type": "application/x-ndjson" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-training error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
