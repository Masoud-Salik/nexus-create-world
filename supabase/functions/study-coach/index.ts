import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user from JWT - never trust client-provided userId
    const authHeader = req.headers.get("authorization");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Use service role for data operations (needed for cross-table reads)
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const reqBody = await req.json();
    const { action, mode, duration = "daily", preview, proposed } = reqBody as {
      action: string;
      mode?: string;
      duration?: string;
      preview?: boolean;
      proposed?: unknown[];
    };

    console.log(`Study Coach action: ${action} for user: ${userId}, duration: ${duration}`);

    if (action === "generate-daily-plan") {
      // Get user's subjects with priorities
      const { data: subjects } = await supabase
        .from("study_subjects")
        .select("*")
        .eq("user_id", userId)
        .order("priority_order");

      if (!subjects || subjects.length === 0) {
        throw new Error("No subjects found. Please add subjects first.");
      }

      // Get recent sessions for weak spot detection
      const { data: recentSessions } = await supabase
        .from("study_sessions")
        .select("topic, accuracy_score, subject_id, time_spent_minutes")
        .eq("user_id", userId)
        .order("session_date", { ascending: false })
        .limit(50);

      // Get user's check-in data for energy/mood awareness
      const { data: recentCheckins } = await supabase
        .from("daily_checkins")
        .select("mood_score, energy_score, study_minutes")
        .eq("user_id", userId)
        .order("checkin_date", { ascending: false })
        .limit(7);

      // Get user's goals for alignment
      const { data: goals } = await supabase
        .from("goals")
        .select("goal_title, goal_description")
        .eq("user_id", userId)
        .limit(5);

      // Analyze weak spots
      const topicPerformance: Record<string, { accuracy: number; count: number; totalTime: number }> = {};
      (recentSessions || []).forEach((s) => {
        if (!topicPerformance[s.topic]) {
          topicPerformance[s.topic] = { accuracy: 0, count: 0, totalTime: 0 };
        }
        topicPerformance[s.topic].count++;
        topicPerformance[s.topic].totalTime += s.time_spent_minutes || 0;
        if (s.accuracy_score !== null) {
          topicPerformance[s.topic].accuracy = 
            (topicPerformance[s.topic].accuracy * (topicPerformance[s.topic].count - 1) + s.accuracy_score) / 
            topicPerformance[s.topic].count;
        }
      });

      const weakTopics = Object.entries(topicPerformance)
        .filter(([, data]) => data.accuracy < 70 && data.count >= 2)
        .sort((a, b) => a[1].accuracy - b[1].accuracy)
        .slice(0, 5)
        .map(([topic, data]) => `${topic} (${Math.round(data.accuracy)}% accuracy)`);

      const avgEnergy = recentCheckins && recentCheckins.length > 0
        ? recentCheckins.reduce((sum, c) => sum + (c.energy_score || 3), 0) / recentCheckins.length
        : 3;
      
      const avgStudyTime = recentCheckins && recentCheckins.length > 0
        ? recentCheckins.reduce((sum, c) => sum + (c.study_minutes || 0), 0) / recentCheckins.length
        : 60;

      // Calculate number of days based on duration
      const daysToGenerate = duration === "monthly" ? 30 : duration === "weekly" ? 7 : 1;
      const tasksPerDay = Math.max(2, Math.min(5, Math.ceil(avgStudyTime / 30)));

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      const subjectInfo = subjects.map((s) => ({
        name: s.subject_name,
        weeklyTargetMinutes: s.weekly_target_minutes || 180,
        color: s.color,
        priority: s.priority_order,
      }));

      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

      // Generate dates for the plan
      const dates: string[] = [];
      for (let i = 0; i < daysToGenerate; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split("T")[0]);
      }

      const systemPrompt = `You are an elite study planning AI that creates scientifically-optimized study plans.

═══ PLANNING PRINCIPLES ═══

COGNITIVE SCIENCE FOUNDATION:
• Ultradian rhythms: Schedule 90-minute focus blocks with breaks
• Interleaving: Mix related subjects for better retention
• Spaced repetition: Prioritize topics that need review
• Difficulty progression: Start with challenging material when fresh
• Weekly rhythm: Lighter loads on weekends, intense mid-week

TASK DESIGN RULES:
• Each task should be SPECIFIC (not "study math" but "Practice quadratic equation word problems")
• Duration should match cognitive load (hard topics: 25-45 min, review: 20-30 min)
• Include review/reinforcement tasks for weak areas
• Balance new learning with consolidation
• Distribute subjects evenly across the time period

MULTI-DAY PLANNING:
• Ensure each subject appears multiple times per week
• Space repetitions optimally (2-3 days between same topic reviews)
• Progressive difficulty over the time period
• Include buffer/catch-up days for longer plans`;

      const userPrompt = `Create an optimized ${duration} study plan starting from today (${dayOfWeek}).

SUBJECTS (in priority order):
${JSON.stringify(subjectInfo, null, 2)}

WEAK AREAS REQUIRING ATTENTION:
${weakTopics.length > 0 ? weakTopics.join("\n") : "No significant weak spots detected yet"}

USER STATE:
• Average energy level: ${avgEnergy.toFixed(1)}/5
• Typical daily study time: ${Math.round(avgStudyTime)} minutes
• Goals: ${goals?.map(g => g.goal_title).join(", ") || "None specified"}

REQUIREMENTS:
1. Generate tasks for ${daysToGenerate} day(s)
2. Each day should have ${tasksPerDay}-${tasksPerDay + 2} tasks
3. Daily total time should be ~${Math.round(avgStudyTime)} minutes
4. Distribute subjects evenly across all days
5. At least one task per day should address weak areas
6. Include specific topics, not generic subject names
7. Vary difficulty based on day of week (harder on weekdays)

DATES TO PLAN FOR:
${dates.map(d => `- ${d} (${new Date(d).toLocaleDateString('en-US', { weekday: 'long' })})`).join("\n")}

Return ONLY a JSON array:
[
  {
    "date": "YYYY-MM-DD",
    "subject_name": "exact match to subject name from list",
    "topic": "Specific, focused topic",
    "duration_minutes": 25-60,
    "difficulty": "easy" | "medium" | "hard"
  }
]`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "[]";
      
      let tasksToCreate;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        tasksToCreate = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        // Fallback: create balanced tasks for all dates
        tasksToCreate = [];
        dates.forEach((date, dayIndex) => {
          subjects.forEach((s, i) => {
            if (i < tasksPerDay) {
              tasksToCreate.push({
                date,
                subject_name: s.subject_name,
                topic: `${s.subject_name} - Core Concepts Review`,
                duration_minutes: i === 0 ? 45 : 30,
                difficulty: dayIndex % 2 === 0 ? "medium" : "easy",
              });
            }
          });
        });
      }

      // Map subject names to IDs
      const subjectMap: Record<string, string> = {};
      subjects.forEach((s) => {
        subjectMap[s.subject_name.toLowerCase()] = s.id;
      });

      // Delete existing tasks for the date range
      await supabase
        .from("study_tasks")
        .delete()
        .eq("user_id", userId)
        .gte("task_date", dates[0])
        .lte("task_date", dates[dates.length - 1]);

      // Create new tasks with fallback matching
      const newTasks = tasksToCreate.map((t: any, index: number) => {
        // Try exact match, then lowercase match, then fallback to first subject
        let subjectId = subjectMap[t.subject_name] || 
                        subjectMap[t.subject_name?.toLowerCase()] ||
                        subjects[index % subjects.length].id;
        
        // Validate date is in our range
        const taskDate = dates.includes(t.date) ? t.date : dates[index % dates.length];
        
        return {
          user_id: userId,
          subject_id: subjectId,
          task_date: taskDate,
          topic: t.topic || `${t.subject_name} Practice`,
          duration_minutes: Math.max(15, Math.min(90, t.duration_minutes || 30)),
          difficulty: ["easy", "medium", "hard"].includes(t.difficulty) ? t.difficulty : "medium",
          status: "pending",
        };
      });

      const { error: insertError } = await supabase.from("study_tasks").insert(newTasks);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tasksCreated: newTasks.length,
        daysPlanned: daysToGenerate,
        totalMinutes: newTasks.reduce((s: number, t: { duration_minutes: number }) => s + t.duration_minutes, 0)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "adjust-plan") {
      // New flow: preview=true → return AI-proposed tasks without writing.
      //           preview=false + proposed[] → apply provided proposed tasks.
      const today = new Date().toISOString().split("T")[0];

      const { data: tasks } = await supabase
        .from("study_tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("task_date", today)
        .in("status", ["pending", "in_progress"]);

      if (!tasks || tasks.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No tasks to adjust" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ----- APPLY MODE -----
      if (preview === false && Array.isArray(proposed) && proposed.length > 0) {
        const updates = proposed
          .filter((p: any) => p && p.id)
          .map((p: any) => ({
            id: p.id,
            duration_minutes: Math.max(15, Math.min(120, Number(p.duration_minutes) || 30)),
            difficulty: ["easy", "medium", "hard"].includes(p.difficulty) ? p.difficulty : "medium",
            topic: typeof p.topic === "string" && p.topic.length > 0 ? p.topic.slice(0, 200) : undefined,
          }));

        for (const u of updates) {
          const patch: Record<string, unknown> = {
            duration_minutes: u.duration_minutes,
            difficulty: u.difficulty,
          };
          if (u.topic) patch.topic = u.topic;
          await supabase.from("study_tasks").update(patch).eq("id", u.id).eq("user_id", userId);
        }

        return new Response(JSON.stringify({ success: true, applied: updates.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ----- PREVIEW MODE: use AI to re-plan -----
      // Fetch lightweight context for smarter adjustment
      const { data: recentCheckins } = await supabase
        .from("daily_checkins")
        .select("mood_score, energy_score")
        .eq("user_id", userId)
        .order("checkin_date", { ascending: false })
        .limit(3);

      const avgEnergy = recentCheckins && recentCheckins.length > 0
        ? recentCheckins.reduce((s, c) => s + (c.energy_score || 3), 0) / recentCheckins.length
        : 3;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const nowHour = new Date().getHours();

      const modeGuidance: Record<string, string> = {
        less_time: "User has less time. Cut total duration by ~40%, keep priority topics, drop low-impact ones.",
        tired: "User is tired. Reduce difficulty one notch, cut duration ~30%, prefer review over new material.",
        push_harder: "User wants challenge. Add 25% duration on hard topics, bump difficulty one notch where possible.",
        quick_review: "Convert all tasks into 15-25min spaced-repetition review of weak topics. Keep them light cognitively.",
        swap_subject: "Reorder for optimal interleaving: never two consecutive same-subject tasks. Shuffle topics within subject if needed.",
        evening: `It's ${nowHour}h. Reduce cognitive load: shorter blocks, easier difficulty, recall practice over new theory.`,
      };

      const adjustPrompt = `You are NEXUS, a science-based study planner. Adjust today's remaining tasks based on the user's state.

CURRENT TASKS (do NOT change ids):
${JSON.stringify(tasks.map((t: any) => ({ id: t.id, subject_id: t.subject_id, topic: t.topic, duration_minutes: t.duration_minutes, difficulty: t.difficulty })), null, 2)}

USER STATE:
- Energy: ${avgEnergy.toFixed(1)}/5
- Local hour: ${nowHour}
- Adjustment mode: ${mode} → ${modeGuidance[mode] || "Rebalance sensibly."}

RULES:
- Keep ALL task ids unchanged.
- Duration: 15-90 min per task.
- Difficulty: easy | medium | hard.
- Interleave subjects (no two consecutive same subject_id when possible).
- You may rewrite the topic to be more specific or shift focus (e.g. "Derivatives — practice problems" → "Derivatives — recall flashcards").

Return ONLY JSON:
{
  "rationale": "one short sentence explaining the change",
  "tasks": [
    { "id": "...", "subject_name": "...", "topic": "...", "duration_minutes": 30, "difficulty": "medium" }
  ]
}`;

      const subjectNameById: Record<string, string> = {};
      const { data: subjList } = await supabase.from("study_subjects").select("id, subject_name").eq("user_id", userId);
      (subjList || []).forEach((s: any) => { subjectNameById[s.id] = s.subject_name; });

      let rationale = "Rebalanced your remaining quests.";
      let proposedTasks: any[] = [];

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You return only valid JSON. No prose outside the JSON." },
              { role: "user", content: adjustPrompt },
            ],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (parsed?.tasks && Array.isArray(parsed.tasks)) {
          rationale = parsed.rationale || rationale;
          proposedTasks = parsed.tasks
            .map((p: any) => {
              const orig = tasks.find((t: any) => t.id === p.id);
              if (!orig) return null;
              return {
                id: orig.id,
                subject_name: p.subject_name || subjectNameById[orig.subject_id] || "Subject",
                topic: typeof p.topic === "string" ? p.topic.slice(0, 200) : orig.topic,
                duration_minutes: Math.max(15, Math.min(90, Number(p.duration_minutes) || orig.duration_minutes)),
                difficulty: ["easy", "medium", "hard"].includes(p.difficulty) ? p.difficulty : orig.difficulty,
              };
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.error("Adjust AI error:", e);
      }

      // Deterministic fallback if AI failed
      if (proposedTasks.length === 0) {
        const fallbackAdjust: Record<string, { d: number; df: number }> = {
          less_time: { d: 0.6, df: 0 },
          tired: { d: 0.7, df: -1 },
          push_harder: { d: 1.25, df: 1 },
          quick_review: { d: 0.5, df: -1 },
          swap_subject: { d: 1, df: 0 },
          evening: { d: 0.75, df: -1 },
        };
        const a = fallbackAdjust[mode] || fallbackAdjust.less_time;
        const order = ["easy", "medium", "hard"];
        proposedTasks = tasks.map((t: any) => {
          const idx = order.indexOf(t.difficulty);
          const newIdx = Math.max(0, Math.min(2, idx + a.df));
          return {
            id: t.id,
            subject_name: subjectNameById[t.subject_id] || "Subject",
            topic: t.topic,
            duration_minutes: Math.max(15, Math.round(t.duration_minutes * a.d)),
            difficulty: order[newIdx],
          };
        });
        rationale = `Quick rebalance for ${mode.replace("_", " ")}.`;
      }

      return new Response(JSON.stringify({ success: true, preview: true, rationale, tasks: proposedTasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "__legacy_adjust_disabled__") {
      const adjustments = {
        less_time: { durationMultiplier: 0.6, difficultyShift: 0 },
        tired: { durationMultiplier: 0.7, difficultyShift: -1 },
        push_harder: { durationMultiplier: 1.25, difficultyShift: 1 },
        quick_review: { durationMultiplier: 0.5, difficultyShift: -1 },
      };
      void adjustments;
      return new Response(JSON.stringify({ success: false }), { headers: corsHeaders, status: 400 });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("Study Coach error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
