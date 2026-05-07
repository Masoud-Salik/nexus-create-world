import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, messageId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Extracting memory from message:", message.substring(0, 100));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a memory extraction assistant. Analyze user messages to identify stable personal information worth remembering for future conversations.

CATEGORIES to look for:
- "like" - things the user enjoys, loves, or is enthusiastic about
- "dislike" - things the user dislikes, hates, or wants to avoid
- "preference" - general preferences and favorites (study style, tools, methods)
- "habit" - daily routines, recurring behaviors
- "goal" - aspirations, plans, targets
- "personal_fact" - biographical info (job, location, relationships)
- "belief" - values, opinions, worldviews
- "health" - fitness routines, diet, medical info
- "skill" - abilities, expertise, learning areas

RULES:
1. Only extract STABLE information (not temporary states like "I'm tired today")
2. Summarize into 1-2 short sentences
3. Be specific and actionable for future personalization
4. Skip greetings, questions, or transient chat
5. Pay special attention to likes and dislikes — these are highly valuable for personalization
6. Assess sentiment intensity: "strong" (loves/hates), "moderate" (likes/prefers), "mild" (sometimes/doesn't mind)

Respond with JSON only:
{
  "should_save": boolean,
  "category": "like" | "dislike" | "preference" | "habit" | "goal" | "personal_fact" | "belief" | "health" | "skill",
  "content": "extracted memory summary",
  "sentiment": "strong" | "moderate" | "mild"
}

If nothing worth saving, respond: {"should_save": false, "category": null, "content": null, "sentiment": null}`
          },
          {
            role: "user",
            content: message
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_memory",
              description: "Extract a memory from the user message if it contains stable personal information",
              parameters: {
                type: "object",
                properties: {
                  should_save: {
                    type: "boolean",
                    description: "Whether this message contains information worth saving"
                  },
                  category: {
                    type: "string",
                    enum: ["like", "dislike", "preference", "habit", "goal", "personal_fact", "belief", "health", "skill"],
                    description: "Category of the memory"
                  },
                  content: {
                    type: "string",
                    description: "The extracted memory content in 1-2 sentences"
                  },
                  sentiment: {
                    type: "string",
                    enum: ["strong", "moderate", "mild"],
                    description: "How strongly the user feels about this"
                  }
                },
                required: ["should_save"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_memory" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ should_save: false, category: null, content: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Extracted memory:", result);

    return new Response(
      JSON.stringify({
        should_save: result.should_save || false,
        category: result.category || null,
        content: result.content || null,
      messageId,
      sentiment: result.sentiment || "moderate"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Extract memory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
