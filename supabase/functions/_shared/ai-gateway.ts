// Shared Lovable AI Gateway helper for Edge Functions.
// Returns a fetch-based client targeting the OpenAI-compatible gateway.

const BASE = "https://ai.gateway.lovable.dev/v1";

export function aiGateway() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  return {
    async chatStream(body: Record<string, unknown>, signal?: AbortSignal) {
      return fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: JSON.stringify({ ...body, stream: true }),
        signal,
      });
    },
    async chat(body: Record<string, unknown>) {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "Lovable-API-Key": key,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
      return r.json();
    },
    async embed(input: string | string[], model = "google/gemini-embedding-001", dimensions = 768) {
      const r = await fetch(`${BASE}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({ model, input, dimensions }),
      });
      if (!r.ok) throw new Error(`Embed ${r.status}: ${await r.text()}`);
      const j = await r.json();
      return j.data.map((d: { embedding: number[] }) => d.embedding) as number[][];
    },
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};