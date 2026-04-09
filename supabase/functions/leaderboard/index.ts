import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "compute-score") {
      const score = await computeUserScore(supabase, user.id);
      return new Response(JSON.stringify({ score }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-leaderboard") {
      const monday = getMonday(new Date());
      const weekStart = formatDate(monday);

      const { data: leaderboard } = await supabase
        .from("weekly_leaderboard")
        .select("user_id, study_hours, streak_days, days_studied, discipline_score")
        .eq("week_start", weekStart)
        .order("discipline_score", { ascending: false })
        .limit(50);

      if (!leaderboard || leaderboard.length === 0) {
        return new Response(JSON.stringify({ leaderboard: [], userRank: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = leaderboard.map((e) => e.user_id);
      const { data: optIns } = await supabase
        .from("leaderboard_opt_ins")
        .select("user_id, display_name, country, is_studying")
        .in("user_id", userIds)
        .eq("is_active", true);

      const optInMap = new Map((optIns || []).map((o) => [o.user_id, o]));

      const visibleLeaderboard = leaderboard
        .filter((e) => optInMap.has(e.user_id))
        .map((e, i) => {
          const opt = optInMap.get(e.user_id)!;
          return {
            rank: i + 1,
            display_name: opt.display_name || "Anonymous",
            country: opt.country || null,
            is_studying: opt.is_studying || false,
            study_hours: Number(e.study_hours),
            streak_days: e.streak_days,
            days_studied: e.days_studied,
            discipline_score: Number(e.discipline_score),
            is_current_user: e.user_id === user.id,
            tier: getTier(Number(e.discipline_score)),
            xp: scoreToXP(Number(e.discipline_score), e.streak_days, Number(e.study_hours)),
            level: xpToLevel(scoreToXP(Number(e.discipline_score), e.streak_days, Number(e.study_hours))),
          };
        });

      const userRank = visibleLeaderboard.find((e) => e.is_current_user)?.rank || null;

      return new Response(JSON.stringify({ leaderboard: visibleLeaderboard, userRank }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-trends") {
      const trends = await getUserTrends(supabase, user.id);
      return new Response(JSON.stringify(trends), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function computeUserScore(supabase: any, userId: string) {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekStart = formatDate(monday);
  const weekEnd = formatDate(sunday);

  // Study hours this week (with bonus multiplier)
  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("time_spent_minutes, session_date, is_bonus")
    .eq("user_id", userId)
    .gte("session_date", weekStart)
    .lte("session_date", weekEnd);

  let totalMinutes = 0;
  for (const s of (sessions || [])) {
    const mins = s.time_spent_minutes || 0;
    totalMinutes += s.is_bonus ? Math.round(mins * 1.5) : mins;
  }
  const studyHours = totalMinutes / 60;

  const uniqueDays = new Set((sessions || []).map((s: any) => s.session_date));
  const daysStudied = uniqueDays.size;

  const { data: habit } = await supabase
    .from("habits")
    .select("current_streak, longest_streak, total_completions")
    .eq("user_id", userId)
    .eq("habit_type", "study")
    .maybeSingle();

  const streakDays = habit?.current_streak || 0;

  const { data: tasks } = await supabase
    .from("study_tasks")
    .select("id, status, difficulty")
    .eq("user_id", userId)
    .gte("task_date", weekStart)
    .lte("task_date", weekEnd);

  const completedTasks = (tasks || []).filter((t: any) => t.status === "completed");
  const totalTasks = (tasks || []).length;
  const taskCompletionRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

  const difficultyBonus = completedTasks.reduce((sum: number, t: any) => {
    if (t.difficulty === "hard") return sum + 1.5;
    if (t.difficulty === "medium") return sum + 1.0;
    return sum + 0.5;
  }, 0);
  const maxDifficultyBonus = Math.max(completedTasks.length * 1.5, 1);
  const difficultyNormalized = Math.min(difficultyBonus / maxDifficultyBonus, 1.0);

  const consistencyRatio = Math.min(daysStudied / 7, 1.0);
  const streakNormalized = Math.min(Math.log(streakDays + 1) / Math.log(31), 1.0);
  const MAX_WEEKLY_HOURS = 20;
  const volumeNormalized = Math.min(studyHours / MAX_WEEKLY_HOURS, 1.0);
  const taskNormalized = taskCompletionRate;
  const diffNormalized = difficultyNormalized;

  const disciplineScore = Math.round(
    (consistencyRatio * 30 + streakNormalized * 25 + volumeNormalized * 20 + taskNormalized * 15 + diffNormalized * 10) * 10
  ) / 10;

  await supabase
    .from("weekly_leaderboard")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        study_hours: Math.round(studyHours * 10) / 10,
        streak_days: streakDays,
        days_studied: daysStudied,
        discipline_score: disciplineScore,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    );

  const badges = computeBadges(streakDays, studyHours, completedTasks.length, daysStudied, habit?.longest_streak || 0);

  return {
    study_hours: Math.round(studyHours * 10) / 10,
    streak_days: streakDays,
    days_studied: daysStudied,
    discipline_score: disciplineScore,
    tasks_completed: completedTasks.length,
    total_tasks: totalTasks,
    task_completion_rate: Math.round(taskCompletionRate * 100),
    tier: getTier(disciplineScore),
    xp: scoreToXP(disciplineScore, streakDays, studyHours),
    level: xpToLevel(scoreToXP(disciplineScore, streakDays, studyHours)),
    badges,
  };
}

async function getUserTrends(supabase: any, userId: string) {
  const weeks: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    weeks.push(formatDate(getMonday(d)));
  }

  const { data } = await supabase
    .from("weekly_leaderboard")
    .select("week_start, study_hours, streak_days, days_studied, discipline_score")
    .eq("user_id", userId)
    .in("week_start", weeks)
    .order("week_start", { ascending: true });

  const entries = data || [];
  const currentWeek = entries[entries.length - 1];
  const previousWeek = entries.length >= 2 ? entries[entries.length - 2] : null;

  let scoreChange = 0, hoursChange = 0, consistencyChange = 0;
  if (currentWeek && previousWeek) {
    scoreChange = Math.round((Number(currentWeek.discipline_score) - Number(previousWeek.discipline_score)) * 10) / 10;
    hoursChange = Math.round((Number(currentWeek.study_hours) - Number(previousWeek.study_hours)) * 10) / 10;
    consistencyChange = currentWeek.days_studied - previousWeek.days_studied;
  }

  let insight = "Start studying to see your trends!";
  if (currentWeek) {
    if (scoreChange > 0) insight = "📈 You're improving! Keep up the momentum.";
    else if (scoreChange < 0) insight = "📉 Score dipped. Try studying more consistently.";
    else if (currentWeek.days_studied >= 5) insight = "🔥 Excellent consistency!";
    else if (currentWeek.days_studied <= 2) insight = "💡 Daily consistency beats binge study.";
    else insight = "⚡ Steady progress. Push for one more day!";
  }

  return {
    weeks: entries.map((e: any) => ({ week_start: e.week_start, score: Number(e.discipline_score), hours: Number(e.study_hours), days: e.days_studied })),
    changes: { scoreChange, hoursChange, consistencyChange },
    insight,
  };
}

function computeBadges(streak: number, hours: number, tasksCompleted: number, daysStudied: number, longestStreak: number) {
  return [
    { id: "streak_3", name: "3-Day Streak", emoji: "🔥", unlocked: streak >= 3 },
    { id: "streak_7", name: "7-Day Streak", emoji: "⚡", unlocked: streak >= 7 },
    { id: "streak_14", name: "14-Day Streak", emoji: "💎", unlocked: streak >= 14 },
    { id: "streak_30", name: "30-Day Streak", emoji: "👑", unlocked: longestStreak >= 30 },
    { id: "hours_5", name: "5h Week", emoji: "📚", unlocked: hours >= 5 },
    { id: "hours_10", name: "10h Week", emoji: "🧠", unlocked: hours >= 10 },
    { id: "hours_20", name: "20h Beast", emoji: "💪", unlocked: hours >= 20 },
    { id: "tasks_5", name: "5 Tasks", emoji: "✅", unlocked: tasksCompleted >= 5 },
    { id: "tasks_10", name: "10 Tasks", emoji: "🏆", unlocked: tasksCompleted >= 10 },
    { id: "perfect_week", name: "Perfect Week", emoji: "⭐", unlocked: daysStudied >= 7 },
  ];
}

function getTier(score: number): string {
  if (score >= 80) return "diamond";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  if (score >= 20) return "bronze";
  return "unranked";
}

function scoreToXP(score: number, streak: number, hours: number): number {
  return Math.round(score * 10 + streak * 5 + hours * 15);
}

function xpToLevel(xp: number): number {
  let level = 1;
  let threshold = 0;
  while (threshold <= xp) {
    level++;
    threshold += 50 + level * 25;
  }
  return level - 1;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
