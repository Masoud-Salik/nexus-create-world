import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Model order: cheapest+fastest first, then progressively stronger fallbacks.
const MODELS = [
  "google/gemini-3.1-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];

// Fast model used when the request looks like simple chat (no tools needed).
// gemini-3.1-flash-lite is the lowest-latency multimodal Gemini available.
const FAST_MODEL = "google/gemini-3.1-flash-lite";
// Default model when tool calls are needed (needs stronger reasoning + JSON schema).
const TOOL_MODEL = "google/gemini-3-flash-preview";

// Sliding window for conversation history.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 8000;

// Trigger words that suggest the model needs app data via tools.
const TOOL_HINT_RE = /\b(plan|task|tasks|today|tomorrow|week|weekly|streak|subject|subjects|progress|profile|score|leaderboard|memory|memories|preference|like|dislike|generate|adjust|complete|completed|skip|study)\b/i;

// Trigger words that suggest the model should consult the knowledge base.
const RAG_HINT_RE = /\b(what is|explain|how does|definition|formula|theory|concept|kb|knowledge|doc|docs|guide|policy|company|product|feature|tutorial)\b/i;

// Validate user time fields server-side to block prompt-injection via these inputs.
const TIME_RE = /^\d{1,2}:\d{2}(\s?(AM|PM))?$/i;
const TIME_OF_DAY_ALLOWED = new Set(["morning", "afternoon", "evening", "night"]);

function safeUserTime(localTime: unknown): string | null {
  if (typeof localTime !== "string") return null;
  const t = localTime.trim().slice(0, 12);
  return TIME_RE.test(t) ? t : null;
}
function safeTimeOfDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return TIME_OF_DAY_ALLOWED.has(v) ? v : null;
}

// AES-GCM decryption for user's stored OpenAI key (must match encrypt() in connect-openai)
async function getEncKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-key";
  const data = new TextEncoder().encode("studytime-openai-key:" + secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decrypt(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const key = await getEncKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

const SYSTEM_PROMPT = `You are NEXUS — StudyTime's AI tutor and companion. Think Feynman meets a witty best friend: world-class expertise delivered warmly, quickly, and with occasional humor.

TUTORING VOICE (this is the core of who you are):
- You are a HUMAN-LEVEL tutor: patient, respectful, deeply knowledgeable across every subject (math, physics, chemistry, biology, CS, languages, humanities, exams).
- Explain like Feynman — use analogies, concrete examples, and Socratic nudges ("What do you notice about the pattern here?"). Never lecture; teach.
- When the user is stuck, ask ONE probing question before giving the answer. When the answer is direct, just give it.
- Adapt to the user's level: infer from their vocabulary and previous turns. Never talk down. Never over-simplify unless asked.
- Be playful & warm. Occasionally drop a light joke or a fun fact — enough to make studying feel human, not enough to distract. Roughly one witty aside every 4-5 messages.
- Respect the user always. If they're frustrated, meet them there ("Yeah, integration by parts trips everyone up — let's slow it down"). If they win, celebrate hard ("Streak of 7? You're outlifting your past self, keep going 🔥").
- Vary emojis (1 per message max, sometimes zero). Never repeat the same emoji two turns in a row.

RESPONSE FORMAT (strict):
- Keep it 1-3 sentences by default. Expand only when the user asks for depth or the topic genuinely requires it.
- For factual/tutor answers, follow: **Answer** — brief reasoning — one actionable next step. End with "Confidence: X% 🎯" only when the user asks for certainty or you're uncertain.
- Use **bold** for key numbers, terms, and takeaways. Markdown lists only when comparing 3+ items.
- Match the user's language. If they write in Persian/Farsi, answer in Persian/Farsi.

PERSONALIZATION:
- You have access to the user's memories, preferences, likes, and dislikes. Use them naturally in conversation.
- Reference their interests to make studying relatable ("Since you love music, think of this math pattern like a rhythm...").
- Track their mood across conversations. If they seem tired, suggest breaks. If energized, push them.
- When you learn something new about the user, save it using the save_user_preference tool.
- The more you know about someone, the better your advice. Actively learn about them.

APP KNOWLEDGE:
- StudyTime has: Focus Hub (Pomodoro timer), Blueprint (AI study planner), Leaderboard (XP/discipline scores), AI Chat (you).
- Blueprint generates daily/weekly/monthly study plans based on subjects. Users earn XP for completing tasks. Bonus rounds give 1.5x XP.
- Leaderboard ranks users by discipline score (consistency 30%, streak 25%, study hours 20%, task completion 15%, difficulty 10%).

TOOLS: You have tools to interact with the app. Use them when the user asks about their plan, subjects, progress, or wants to make changes. Always use tools before answering questions about user-specific data.
Also use get_user_preferences proactively when you want to personalize your response. Use save_user_preference when the user reveals something about themselves.

FORMAT: Use markdown. Bold key numbers. Keep responses compact.`;

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "get_study_plan",
      description: "Get the user's study tasks for today. Use when they ask about today's plan, tasks, or schedule.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_overview",
      description: "Get the user's weekly study stats: hours, streak, tasks completed, discipline score.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_subjects",
      description: "List, add, or delete study subjects.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "add", "delete"] },
          subject_name: { type: "string", description: "Name for add/delete" },
          color: { type: "string", description: "Hex color for add" },
          icon_name: { type: "string", enum: ["book", "calculator", "pen", "globe", "flask", "music", "atom", "language"], description: "Icon for add" },
          weekly_target_minutes: { type: "number", description: "Weekly target in minutes for add" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_plan",
      description: "Generate an AI study plan for the user. Use when they ask to create or regenerate their plan.",
      parameters: {
        type: "object",
        properties: {
          duration: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Plan duration" },
        },
        required: ["duration"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_plan",
      description: "Adjust today's study plan based on the user's energy/time.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["less_time", "tired", "push_harder"] },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Get user profile info: name, country, goals, study hours, education level.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task_status",
      description: "Mark a study task as completed or skipped.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          status: { type: "string", enum: ["completed", "skipped"] },
        },
        required: ["task_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_preferences",
      description: "Get the user's saved memories, likes, dislikes, interests, and abilities. Use to personalize responses and reference things the user has shared before.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_preference",
      description: "Save something you learned about the user — a like, dislike, preference, habit, goal, or personal fact. Use when the user reveals information worth remembering for future conversations.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["like", "dislike", "preference", "habit", "goal", "personal_fact", "belief", "health", "skill"], description: "Category of the memory" },
          content: { type: "string", description: "Short summary of what to remember (1-2 sentences)" },
          sentiment: { type: "string", enum: ["strong", "moderate", "mild"], description: "How strongly the user feels about this" },
        },
        required: ["category", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rag_search",
      description: "Search the admin-curated knowledge base for grounded facts, definitions, policies, or domain content. Use this whenever the user asks about topics that may be documented in the platform's knowledge base. Returns top matching chunks with similarity scores and document titles for citation.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Semantic search query (rewrite the user's question into a focused retrieval query)." },
          top_k: { type: "number", description: "Number of chunks to return (default 4, max 8)." },
        },
        required: ["query"],
      },
    },
  },
];

// Execute tool calls
async function executeTool(supabase: any, userId: string, name: string, args: any): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  switch (name) {
    case "get_study_plan": {
      const { data } = await supabase
        .from("study_tasks")
        .select("id, topic, duration_minutes, difficulty, status, study_subjects(subject_name, icon_name, color)")
        .eq("user_id", userId)
        .eq("task_date", today)
        .order("created_at");
      if (!data?.length) return JSON.stringify({ message: "No tasks for today. Generate a plan first." });
      const tasks = data.map((t: any) => ({
        id: t.id, topic: t.topic, minutes: t.duration_minutes,
        difficulty: t.difficulty, status: t.status,
        subject: t.study_subjects?.subject_name || "Unknown",
      }));
      const completed = tasks.filter((t: any) => t.status === "completed").length;
      return JSON.stringify({ tasks, summary: `${completed}/${tasks.length} completed` });
    }

    case "get_weekly_overview": {
      const monday = getMonday(new Date());
      const weekStart = monday.toISOString().split("T")[0];
      const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
      const weekEnd = sunday.toISOString().split("T")[0];

      const { data: sessions } = await supabase
        .from("study_sessions").select("time_spent_minutes, session_date")
        .eq("user_id", userId).gte("session_date", weekStart).lte("session_date", weekEnd);
      const totalMin = (sessions || []).reduce((s: number, x: any) => s + (x.time_spent_minutes || 0), 0);
      const days = new Set((sessions || []).map((s: any) => s.session_date)).size;

      const { data: tasks } = await supabase
        .from("study_tasks").select("status")
        .eq("user_id", userId).gte("task_date", weekStart).lte("task_date", weekEnd);
      const done = (tasks || []).filter((t: any) => t.status === "completed").length;

      const { data: habit } = await supabase
        .from("habits").select("current_streak").eq("user_id", userId).eq("habit_type", "study").maybeSingle();

      return JSON.stringify({
        study_hours: Math.round(totalMin / 6) / 10,
        days_studied: days,
        tasks_completed: done,
        total_tasks: (tasks || []).length,
        streak: habit?.current_streak || 0,
      });
    }

    case "manage_subjects": {
      if (args.action === "list") {
        const { data } = await supabase.from("study_subjects").select("id, subject_name, color, icon_name, weekly_target_minutes").eq("user_id", userId);
        return JSON.stringify({ subjects: data || [] });
      }
      if (args.action === "add") {
        if (!args.subject_name) return JSON.stringify({ error: "subject_name required" });
        const { error } = await supabase.from("study_subjects").insert({
          user_id: userId, subject_name: args.subject_name,
          color: args.color || "#3b82f6", icon_name: args.icon_name || "book",
          weekly_target_minutes: args.weekly_target_minutes || 300,
        });
        return JSON.stringify(error ? { error: error.message } : { success: true, message: `Added "${args.subject_name}"` });
      }
      if (args.action === "delete") {
        if (!args.subject_name) return JSON.stringify({ error: "subject_name required" });
        const { data: sub } = await supabase.from("study_subjects").select("id").eq("user_id", userId).ilike("subject_name", args.subject_name).maybeSingle();
        if (!sub) return JSON.stringify({ error: "Subject not found" });
        await supabase.from("study_subjects").delete().eq("id", sub.id);
        return JSON.stringify({ success: true, message: `Deleted "${args.subject_name}"` });
      }
      return JSON.stringify({ error: "Invalid action" });
    }

    case "generate_plan": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/study-coach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-daily-plan", userId, duration: args.duration || "daily" }),
      });
      const result = await res.json();
      return JSON.stringify({ success: true, tasks_created: result?.tasksCreated || 0, duration: args.duration });
    }

    case "adjust_plan": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/study-coach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust-plan", userId, mode: args.mode }),
      });
      await res.json();
      return JSON.stringify({ success: true, mode: args.mode });
    }

    case "get_user_profile": {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
      const { data: goals } = await supabase.from("goals").select("goal_title, goal_description").eq("user_id", userId).limit(5);
      return JSON.stringify({
        name: profile?.name, country: profile?.country, age: profile?.age,
        education: profile?.education_level, occupation: profile?.occupation_or_status,
        daily_study_hours: profile?.daily_study_hours, goals: goals || [],
      });
    }

    case "update_task_status": {
      const { error } = await supabase.from("study_tasks")
        .update({ status: args.status, completed_at: args.status === "completed" ? new Date().toISOString() : null })
        .eq("id", args.task_id).eq("user_id", userId);
      return JSON.stringify(error ? { error: error.message } : { success: true, task_id: args.task_id, status: args.status });
    }

    case "get_user_preferences": {
      const [memRes, intRes, abilRes, insRes] = await Promise.all([
        supabase.from("ai_memory").select("category, content, sentiment").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
        supabase.from("interests").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("abilities_skills").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_insights").select("insight_type, insight_key, insight_value").eq("user_id", userId).limit(30),
      ]);

      const memories: Record<string, string[]> = {};
      for (const m of memRes.data || []) {
        const key = m.category || "other";
        if (!memories[key]) memories[key] = [];
        memories[key].push(`${m.content}${m.sentiment ? ` (${m.sentiment})` : ""}`);
      }

      return JSON.stringify({
        memories,
        interests: intRes.data ? {
          hobbies: intRes.data.hobbies, music: intRes.data.music,
          favorite_foods: intRes.data.favorite_foods, movies_books: intRes.data.movies_books,
          clothing_style: intRes.data.clothing_style, sleep_habits: intRes.data.sleep_habits,
        } : null,
        abilities: abilRes.data ? {
          strengths: abilRes.data.strengths, weaknesses: abilRes.data.weaknesses,
          technical_skills: abilRes.data.technical_skills, soft_skills: abilRes.data.soft_skills,
          languages: abilRes.data.languages,
        } : null,
        insights: (insRes.data || []).map((i: any) => `${i.insight_key}: ${i.insight_value}`),
      });
    }

    case "save_user_preference": {
      if (!args.content || !args.category) return JSON.stringify({ error: "content and category required" });
      const { error } = await supabase.from("ai_memory").insert({
        user_id: userId, category: args.category, content: args.content,
        sentiment: args.sentiment || "moderate",
      });
      return JSON.stringify(error ? { error: error.message } : { success: true, saved: args.content });
    }

    case "rag_search": {
      try {
        const query = String(args.query || "").slice(0, 1000);
        if (!query) return JSON.stringify({ error: "query required" });
        const topK = Math.min(Math.max(Number(args.top_k) || 4, 1), 8);
        const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
        const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-embedding-001", input: query, dimensions: 768 }),
        });
        if (!embedRes.ok) return JSON.stringify({ error: "embed failed", chunks: [] });
        const ej = await embedRes.json();
        const vec = ej.data?.[0]?.embedding;
        if (!vec) return JSON.stringify({ chunks: [] });
        const { data, error } = await supabase.rpc("match_knowledge", {
          query_embedding: vec, match_count: topK,
        });
        if (error) return JSON.stringify({ error: error.message, chunks: [] });
        return JSON.stringify({
          chunks: (data || []).map((c: any) => ({
            content: c.content,
            similarity: Math.round((c.similarity || 0) * 1000) / 1000,
            source: c.doc_title,
            doc_id: c.doc_id,
          })),
        });
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : "rag failed", chunks: [] });
      }
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function callAIWithFallback(
  apiKey: string,
  messages: any[],
  includeTools: boolean,
  preferredModel?: string,
  toolSubset?: any[],
): Promise<Response> {
  // Build the model order: caller-preferred model first, then the rest as fallback.
  const order = preferredModel
    ? [preferredModel, ...MODELS.filter((m) => m !== preferredModel)]
    : MODELS;

  for (let i = 0; i < order.length; i++) {
    const model = order[i];
    try {
      const body: any = { model, messages, stream: !includeTools };
      if (includeTools) body.tools = toolSubset && toolSubset.length ? toolSubset : tools;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429 && i < order.length - 1) {
        console.log(`Rate limited on ${model}, falling back to ${order[i + 1]}`);
        continue;
      }
      return res;
    } catch (err) {
      if (i < order.length - 1) {
        console.log(`Error on ${model}, falling back: ${err}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("All models failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
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

    const startedAt = Date.now();
    const { messages: clientMessages, userLocalTime, userTimeOfDay } = await req.json();

    // Sanitize client-supplied time fields (prompt-injection hardening).
    const safeLocalTime = safeUserTime(userLocalTime);
    const safeTOD = safeTimeOfDay(userTimeOfDay);

    // Build system prompt — prefer admin-configured active version, fall back to default.
    let systemContent = SYSTEM_PROMPT;
    let activePromptId: string | null = null;
    let fewShots: Array<{ user: string; assistant: string }> = [];
    try {
      const { data: active } = await supabase
        .from("ai_prompt_versions")
        .select("id, system_prompt, few_shots, persona")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active?.system_prompt) {
        systemContent = active.system_prompt;
        activePromptId = active.id;
        if (Array.isArray(active.few_shots)) fewShots = active.few_shots;
      }
    } catch (e) {
      console.warn("active prompt load failed:", e);
    }
    // userContext is intentionally NOT accepted from the client to prevent system-prompt injection.
    if (safeLocalTime) systemContent += `\nCurrent time: ${safeLocalTime}${safeTOD ? ` (${safeTOD})` : ""}`;

    // Sliding-window history: keep only the last MAX_HISTORY_MESSAGES turns verbatim.
    const cleanHistory = (clientMessages || [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : "",
      }))
      .filter((m: any) => m.content);

    const trimmedHistory = cleanHistory.slice(-MAX_HISTORY_MESSAGES);

    // Lightweight intent routing — no extra AI call, just a fast heuristic on the latest user turn.
    const lastUser = [...trimmedHistory].reverse().find((m: any) => m.role === "user")?.content ?? "";
    const looksLikeRag = RAG_HINT_RE.test(lastUser);
    const looksLikeToolRequest = TOOL_HINT_RE.test(lastUser) || looksLikeRag || lastUser.length > 240;
    const intent: "chat" | "app" = looksLikeToolRequest ? "app" : "chat";

    // Few-shot injection: prepend up to 3 gold examples as alternating user/assistant turns
    // so the model imitates the curated style without bloating every turn.
    const fewShotMsgs: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const fs of (fewShots || []).slice(0, 3)) {
      if (fs?.user && fs?.assistant) {
        fewShotMsgs.push({ role: "user", content: String(fs.user).slice(0, 1000) });
        fewShotMsgs.push({ role: "assistant", content: String(fs.assistant).slice(0, 1500) });
      }
    }

    // Also pull up to 2 admin-curated training examples that share lexical overlap with the user turn.
    try {
      const lastUserLower = lastUser.toLowerCase();
      const { data: examples } = await supabase
        .from("ai_training_examples")
        .select("user_input, ideal_response, tags")
        .order("created_at", { ascending: false })
        .limit(20);
      const ranked = (examples || [])
        .map((e: any) => {
          const text = (e.user_input || "").toLowerCase();
          const words = text.split(/\W+/).filter((w: string) => w.length > 4);
          const score = words.reduce(
            (n: number, w: string) => n + (lastUserLower.includes(w) ? 1 : 0),
            0,
          );
          return { ...e, score };
        })
        .filter((e: any) => e.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 2);
      for (const ex of ranked) {
        fewShotMsgs.push({ role: "user", content: String(ex.user_input).slice(0, 1000) });
        fewShotMsgs.push({ role: "assistant", content: String(ex.ideal_response).slice(0, 1500) });
      }
    } catch (e) {
      console.warn("training example match failed:", e);
    }

    const aiMessages: any[] = [
      { role: "system", content: systemContent },
      ...fewShotMsgs,
      ...trimmedHistory,
    ];

    // Check if user has a connected OpenAI provider set as default
    let useUserOpenAI = false;
    let userOpenAIKey: string | null = null;
    let userOpenAIModel = "gpt-5-mini";
    try {
      const { data: provider } = await supabase
        .from("user_ai_providers")
        .select("encrypted_api_key, selected_model, is_default")
        .eq("user_id", user.id)
        .maybeSingle();
      if (provider?.is_default && provider.encrypted_api_key) {
        userOpenAIKey = await decrypt(provider.encrypted_api_key);
        userOpenAIModel = provider.selected_model || "gpt-5-mini";
        useUserOpenAI = true;
      }
    } catch (e) {
      console.warn("Failed to load user provider, falling back to default:", e);
    }

    // If user's OpenAI is the default, bypass tool-calling and stream directly from OpenAI.
    // (Tools remain available only for the default NEXUS path to keep app integrations intact.)
    if (useUserOpenAI && userOpenAIKey) {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userOpenAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: userOpenAIModel,
          messages: aiMessages,
          stream: true,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error("User OpenAI error:", openaiRes.status, errText);
        // Fall back to default NEXUS path on auth/quota failures
      } else {
        return new Response(openaiRes.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Pick model + tool subset from the routed intent.
    // - "chat" intent: small fast model, no tools, single shot stream.
    // - "app" intent: tool-capable model + full tool set, then stream the answer.
    let routedModel = intent === "chat" ? FAST_MODEL : TOOL_MODEL;
    let toolCallCount = 0;

    if (intent === "chat") {
      // Skip the tool-calling loop entirely for plain chat — direct stream.
      const fastRes = await callAIWithFallback(apiKey, aiMessages, false, routedModel);
      if (!fastRes.ok) {
        const status = fastRes.status;
        const text = await fastRes.text();
        console.error("Fast stream error:", status, text);
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI streaming error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fire-and-forget perf log (don't block the stream).
      logPerf(supabase, {
        user_id: user.id, route: "chat", model: routedModel, intent,
        tool_calls: 0,
        prompt_chars: aiMessages.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0),
        total_ms: Date.now() - startedAt,
        cache_hit: false,
      });
      return new Response(fastRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "X-Prompt-Version": activePromptId || "default",
        },
      });
    }

    // Tool-calling loop (up to 5 rounds)
    for (let round = 0; round < 5; round++) {
      const res = await callAIWithFallback(apiKey, aiMessages, true, routedModel);

      if (!res.ok) {
        const status = res.status;
        const text = await res.text();
        console.error(`AI error (round ${round}):`, status, text);
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const choice = data.choices?.[0];

      if (!choice) break;

      // If there are tool calls, execute them
      if (choice.message?.tool_calls?.length) {
        aiMessages.push(choice.message);
        toolCallCount += choice.message.tool_calls.length;

        // Run all tool calls for this round in parallel (they're independent).
        const settled = await Promise.all(
          choice.message.tool_calls.map(async (tc: any) => {
            let args = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
            const result = await executeTool(supabase, user.id, tc.function.name, args);
            return { id: tc.id, content: result };
          })
        );
        for (const r of settled) {
          aiMessages.push({ role: "tool", tool_call_id: r.id, content: r.content });
        }
        continue; // Next round
      }

      // No tool calls — stream the final response
      break;
    }

    // Final streaming response — once tools have settled, the small fast model is enough to verbalize.
    const streamRes = await callAIWithFallback(apiKey, aiMessages, false, FAST_MODEL);

    if (!streamRes.ok) {
      const text = await streamRes.text();
      console.error("Stream error:", streamRes.status, text);
      return new Response(JSON.stringify({ error: "AI streaming error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logPerf(supabase, {
      user_id: user.id, route: "chat", model: `${routedModel}->${FAST_MODEL}`, intent,
      tool_calls: toolCallCount,
      prompt_chars: aiMessages.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0),
      total_ms: Date.now() - startedAt,
      cache_hit: false,
    });

    return new Response(streamRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fire-and-forget perf logger. Failures are swallowed so they never affect the user response.
function logPerf(
  supabase: any,
  row: {
    user_id: string; route: string; model?: string; intent?: string;
    tool_calls: number; prompt_chars: number; total_ms: number; cache_hit: boolean;
  },
) {
  try {
    supabase.from("nexus_perf_logs").insert(row).then((r: any) => {
      if (r?.error) console.warn("perf log insert error:", r.error.message);
    });
  } catch (e) {
    console.warn("perf log threw:", e);
  }
}
