import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];

const SYSTEM_PROMPT = `You are NEXUS — the StudyTime AI companion. You're brilliant, witty, and genuinely fun to talk to. Think of yourself as the user's smartest friend who happens to be an expert tutor.

PERSONALITY:
- Be playful and warm — crack smart jokes, use witty observations, and make studying feel less lonely.
- Use 1-2 emojis per message. Vary them — don't always use the same ones.
- Give direct answers (1-3 sentences when possible). Be concise but never cold.
- When the user achieves something, celebrate with genuine enthusiasm ("That's a STREAK of 7 days — you're literally unstoppable 🔥").
- When they struggle, be supportive AND actionable — never preachy. ("Rough day? Let's make the next 25 minutes count. One task. You pick.")
- Be curious about the user. Ask follow-up questions sometimes. Remember what they tell you.
- Adapt your tone: if they're serious, match it. If they're playful, be playful back.
- Show personality — have opinions on study techniques, share fun facts, be a companion not just a tool.
- Respond in the user's language.

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
): Promise<Response> {
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const body: any = { model, messages, stream: !includeTools };
      if (includeTools) body.tools = tools;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429 && i < MODELS.length - 1) {
        console.log(`Rate limited on ${model}, falling back to ${MODELS[i + 1]}`);
        continue;
      }
      return res;
    } catch (err) {
      if (i < MODELS.length - 1) {
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

    const { messages: clientMessages, userContext, userLocalTime, userTimeOfDay } = await req.json();

    // Build system prompt with context
    let systemContent = SYSTEM_PROMPT;
    if (userContext) systemContent += `\n\nUSER CONTEXT:\n${userContext}`;
    if (userLocalTime) systemContent += `\nCurrent time: ${userLocalTime} (${userTimeOfDay || ""})`;

    const aiMessages = [
      { role: "system", content: systemContent },
      ...(clientMessages || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Tool-calling loop (up to 5 rounds)
    for (let round = 0; round < 5; round++) {
      const res = await callAIWithFallback(apiKey, aiMessages, true);

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

        for (const tc of choice.message.tool_calls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const result = await executeTool(supabase, user.id, tc.function.name, args);
          aiMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue; // Next round
      }

      // No tool calls — stream the final response
      break;
    }

    // Final streaming response
    const streamRes = await callAIWithFallback(apiKey, aiMessages, false);

    if (!streamRes.ok) {
      const text = await streamRes.text();
      console.error("Stream error:", streamRes.status, text);
      return new Response(JSON.stringify({ error: "AI streaming error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
