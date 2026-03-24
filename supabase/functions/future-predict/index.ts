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
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { action, timeframe } = await req.json();

    // Use service role client for data operations
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch comprehensive user data
    const [profileResult, goalsResult, checkinsResult, sessionsResult, skillsResult, memoriesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("daily_checkins").select("*").eq("user_id", userId).order("checkin_date", { ascending: false }).limit(30),
      supabase.from("study_sessions").select("*").eq("user_id", userId).order("session_date", { ascending: false }).limit(50),
      supabase.from("abilities_skills").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("ai_memory").select("category, content").eq("user_id", userId).limit(20),
    ]);

    const profile = profileResult.data;
    const goals = goalsResult.data || [];
    const checkins = checkinsResult.data || [];
    const sessions = sessionsResult.data || [];
    const skills = skillsResult.data;
    const memories = memoriesResult.data || [];

    // Calculate advanced behavioral metrics
    const avgStudyMinutes = checkins.length > 0 
      ? checkins.reduce((sum, c) => sum + (c.study_minutes || 0), 0) / checkins.length 
      : 0;
    const avgMood = checkins.length > 0
      ? checkins.reduce((sum, c) => sum + (c.mood_score || 3), 0) / checkins.length
      : 3;
    const avgEnergy = checkins.length > 0
      ? checkins.reduce((sum, c) => sum + (c.energy_score || 3), 0) / checkins.length
      : 3;
    const consistencyRate = checkins.length > 0 ? (checkins.length / 30) * 100 : 0;
    const totalStudyHours = sessions.reduce((sum, s) => sum + (s.time_spent_minutes || 0), 0) / 60;
    
    // Trend analysis
    const recentCheckins = checkins.slice(0, 7);
    const olderCheckins = checkins.slice(7, 14);
    const recentAvgStudy = recentCheckins.length > 0 ? recentCheckins.reduce((sum, c) => sum + (c.study_minutes || 0), 0) / recentCheckins.length : 0;
    const olderAvgStudy = olderCheckins.length > 0 ? olderCheckins.reduce((sum, c) => sum + (c.study_minutes || 0), 0) / olderCheckins.length : 0;
    const studyTrend = olderAvgStudy > 0 ? ((recentAvgStudy - olderAvgStudy) / olderAvgStudy * 100).toFixed(1) : "0";

    // Memory insights
    const memoryInsights = memories.map(m => `[${m.category}] ${m.content}`).join("\n");

    if (action === "generate-scenarios") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const userContext = `
═══ COMPREHENSIVE USER PROFILE ═══

DEMOGRAPHICS:
• Name: ${profile?.name || "Unknown"}
• Age: ${profile?.age || "Unknown"}
• Country: ${profile?.country || "Unknown"}
• Education: ${profile?.education_level || "Unknown"}
• Field of Interest: ${profile?.field_of_interest || "Unknown"}
• Occupation: ${profile?.occupation_or_status || "Student"}
• Daily Study Target: ${profile?.daily_study_hours || 0} hours
• Financial Constraints: ${profile?.financial_constraints ? "Yes - Limited resources" : "No major constraints"}

ACTIVE GOALS (${goals.length}):
${goals.map(g => `• ${g.goal_title}: ${g.goal_description || "No description"} [${g.goal_duration_days} days]`).join("\n") || "• No goals set"}

SKILLS INVENTORY:
• Technical: ${skills?.technical_skills?.join(", ") || "None documented"}
• Soft Skills: ${skills?.soft_skills?.join(", ") || "None documented"}
• Languages: ${skills?.languages?.join(", ") || "None documented"}
• Strengths: ${skills?.strengths?.join(", ") || "None documented"}
• Weaknesses: ${skills?.weaknesses?.join(", ") || "None documented"}

BEHAVIORAL ANALYTICS (30 Days):
• Daily Study Average: ${Math.round(avgStudyMinutes)} minutes
• Check-in Consistency: ${Math.round(consistencyRate)}%
• Study Trend: ${studyTrend}% change (week-over-week)
• Mood Average: ${avgMood.toFixed(1)}/5
• Energy Average: ${avgEnergy.toFixed(1)}/5
• Total Study Hours Logged: ${Math.round(totalStudyHours)} hours
• Active Study Sessions: ${sessions.length}

PSYCHOLOGICAL INSIGHTS:
${memoryInsights || "No deep insights collected yet"}
`;

      const systemPrompt = `You are an elite future prediction AI combining data science, behavioral psychology, and strategic foresight. Your role is to generate scientifically-grounded, actionable future scenarios.

═══ ANALYTICAL FRAMEWORK ═══

PREDICTION METHODOLOGY:
1. BEHAVIORAL EXTRAPOLATION: Project current patterns forward using compound effect mathematics
2. ENVIRONMENTAL SCANNING: Consider economic, technological, and social trends affecting their field
3. PSYCHOLOGICAL MODELING: Account for motivation patterns, burnout risk, and growth trajectories
4. OPPORTUNITY MAPPING: Identify realistic pathways given their constraints and advantages

SCENARIO REQUIREMENTS:
• Base predictions on actual data, not optimism
• Consider country-specific factors (job markets, education systems, economic conditions)
• Account for compound effects (small daily improvements = massive long-term gains)
• Factor in common failure modes (consistency drops, motivation cycles, external disruptions)

FOR EACH SCENARIO PROVIDE:
1. TITLE: Evocative but realistic headline
2. DESCRIPTION: 3-4 sentences painting a vivid picture with specific details
3. SKILLS_GAINED: Concrete abilities they'll develop through this path
4. OPPORTUNITIES: Doors that open based on this trajectory
5. RISKS: Specific threats and vulnerabilities on this path
6. RECOMMENDATIONS: Actionable steps to move toward best case / avoid worst case
7. PROBABILITY_SCORE: Honest 0-100 based on current behavioral data

PROBABILITY CALCULATION:
• Best case: Requires consistent improvement over baseline (typically 15-35%)
• Realistic: Most likely based on current trajectory (typically 45-65%)
• Worst case: If current problems compound (typically 15-30%)

Be specific to their country, field, and constraints. A student in developing country needs different advice than one in wealthy nation.`;

      const timeframeText = timeframe === "6_months" ? "6 months" : timeframe === "5_years" ? "5 years" : "1 year";

      const userPrompt = `Analyze this user's data and generate three scientifically-grounded future scenarios for ${timeframeText} from now:

${userContext}

CRITICAL: Your predictions must be:
• Grounded in their actual behavioral data (not generic)
• Specific to their field of interest and country context
• Mathematically plausible given their consistency rates
• Actionable with clear cause-effect relationships

Return JSON:
{
  "scenarios": [
    {
      "scenario_type": "best_case",
      "title": "...",
      "description": "Detailed 3-4 sentence narrative with specifics",
      "skills_gained": ["skill1", "skill2", "skill3"],
      "opportunities": ["opportunity1", "opportunity2"],
      "risks": ["risk1", "risk2"],
      "recommendations": ["action1", "action2", "action3"],
      "probability_score": 0-100
    },
    // ... realistic and worst_case
  ]
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      let scenarios;
      try {
        scenarios = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse AI response");
      }

      const scenariosToInsert = (scenarios.scenarios || []).map((s: any) => ({
        user_id: userId,
        timeframe: timeframe || "1_year",
        scenario_type: s.scenario_type,
        title: s.title,
        description: s.description,
        skills_gained: s.skills_gained || [],
        opportunities: s.opportunities || [],
        risks: s.risks || [],
        recommendations: s.recommendations || [],
        probability_score: s.probability_score || 50,
      }));

      await supabase
        .from("future_scenarios")
        .delete()
        .eq("user_id", userId)
        .eq("timeframe", timeframe || "1_year");

      const { error: insertError } = await supabase
        .from("future_scenarios")
        .insert(scenariosToInsert);

      if (insertError) console.error("Error inserting scenarios:", insertError);

      return new Response(JSON.stringify({ success: true, scenarios: scenariosToInsert }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-weekly-report") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const systemPrompt = `You are an analytical AI study coach specializing in behavioral pattern analysis and performance optimization.

ANALYSIS FRAMEWORK:
1. QUANTITATIVE: Evaluate raw numbers against benchmarks
2. QUALITATIVE: Assess consistency, trend direction, and sustainability
3. COMPARATIVE: How does this stack up against high-performers in similar situations?
4. PRESCRIPTIVE: What specific actions would shift the trajectory?

OUTPUT REQUIREMENTS:
• Be data-driven, not motivational
• Identify root causes, not symptoms
• Provide actionable specifics, not vague advice
• Acknowledge progress honestly without inflation`;

      const userPrompt = `Generate a comprehensive weekly progress report:

DATA INPUTS:
• Check-ins completed: ${checkins.slice(0, 7).length}/7 days
• Average study minutes: ${Math.round(recentAvgStudy)}
• Week-over-week change: ${studyTrend}%
• Average mood: ${avgMood.toFixed(1)}/5
• Average energy: ${avgEnergy.toFixed(1)}/5
• Total study sessions: ${sessions.slice(0, 7).length}
• Total study hours this week: ${Math.round(sessions.slice(0, 7).reduce((s, x) => s + (x.time_spent_minutes || 0), 0) / 60)}

BENCHMARKS:
• Top performers average 3+ hours focused study daily
• Consistency above 80% correlates with goal achievement
• Mood/energy below 3.0 indicates burnout risk

Return JSON:
{
  "progress_trend": "improving" | "stable" | "declining",
  "summary": "2-3 sentence factual summary with specific numbers",
  "main_reason": "Root cause of current trend",
  "action_items": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "compared_to_high_performers": "Honest comparison with specifics"
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("AI Gateway error");

      const aiData = await response.json();
      const report = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const reportData = {
        user_id: userId,
        week_start: weekStart.toISOString().split("T")[0],
        week_end: weekEnd.toISOString().split("T")[0],
        progress_trend: report.progress_trend || "stable",
        summary: report.summary || "Insufficient data for analysis",
        main_reason: report.main_reason,
        action_items: report.action_items || [],
        study_hours_logged: totalStudyHours,
        consistency_percentage: Math.round(consistencyRate),
        compared_to_high_performers: report.compared_to_high_performers,
      };

      await supabase
        .from("weekly_reports")
        .upsert(reportData, { onConflict: "user_id,week_start" });

      return new Response(JSON.stringify({ success: true, report: reportData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-daily-coach") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const todayCheckin = checkins.find(c => c.checkin_date === new Date().toISOString().split("T")[0]);
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      
      const systemPrompt = `You are a precision daily coach AI that provides one clear priority and one warning per day.

COACHING PRINCIPLES:
1. ONE FOCUS: Humans perform better with single-pointed attention
2. RISK AWARENESS: Surface threats early before they compound
3. ENERGY MATCHING: Calibrate intensity to their current state
4. ACTIONABILITY: Every output must be immediately executable

Consider the day of the week—Mondays need momentum, Fridays need reflection.`;

      const userPrompt = `Generate today's coaching for ${dayOfWeek}:

USER STATE:
• 7-day study average: ${Math.round(recentAvgStudy)} min/day
• Mood trend: ${avgMood.toFixed(1)}/5
• Energy trend: ${avgEnergy.toFixed(1)}/5
• Today's check-in: ${todayCheckin ? "Completed" : "Not yet"}
• Active goals: ${goals.map(g => g.goal_title).join(", ") || "None set"}
• Consistency rate: ${Math.round(consistencyRate)}%

RISK INDICATORS:
• Burnout risk: ${avgMood < 3 || avgEnergy < 3 ? "ELEVATED" : "Normal"}
• Consistency dropping: ${parseFloat(studyTrend) < -10 ? "YES" : "No"}

Return JSON:
{
  "priority_focus": "One crystal-clear priority for today (max 40 words, specific and actionable)",
  "warning_message": "One specific warning if risk detected, null if none",
  "motivation_level": "low" | "medium" | "high"
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("AI Gateway error");

      const aiData = await response.json();
      const coach = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

      const today = new Date().toISOString().split("T")[0];
      const coachData = {
        user_id: userId,
        message_date: today,
        priority_focus: coach.priority_focus || "Focus on your most important goal today",
        warning_message: coach.warning_message || null,
        motivation_level: coach.motivation_level || "medium",
      };

      await supabase
        .from("daily_coach_messages")
        .upsert(coachData, { onConflict: "user_id,message_date" });

      return new Response(JSON.stringify({ success: true, coach: coachData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "calculate-skill-scores") {
      // Advanced skill calculations
      const disciplineScore = Math.min(100, Math.round(
        consistencyRate * 0.4 + 
        (avgStudyMinutes / 120 * 30) + 
        (checkins.filter(c => (c.study_minutes || 0) >= 60).length / Math.max(checkins.length, 1) * 30)
      ));
      
      const focusScore = Math.min(100, Math.round(
        (avgStudyMinutes / 90 * 40) + 
        (sessions.filter(s => (s.time_spent_minutes || 0) >= 25).length / Math.max(sessions.length, 1) * 40) +
        (avgEnergy / 5 * 20)
      ));
      
      const learningEfficiency = sessions.length > 0 
        ? Math.min(100, Math.round(sessions.reduce((sum, s) => sum + (s.accuracy_score || 65), 0) / sessions.length))
        : 50;
      
      const consistencyScore = Math.min(100, Math.round(
        (checkins.filter(c => (c.study_minutes || 0) > 0).length / Math.max(checkins.length, 1) * 60) +
        (parseFloat(studyTrend) > 0 ? 20 : parseFloat(studyTrend) > -10 ? 10 : 0) +
        (goals.length > 0 ? 20 : 10)
      ));

      const overallScore = Math.round((disciplineScore + focusScore + learningEfficiency + consistencyScore) / 4);

      const today = new Date().toISOString().split("T")[0];
      const scoreData = {
        user_id: userId,
        score_date: today,
        discipline_score: disciplineScore,
        consistency_score: consistencyScore,
        focus_score: focusScore,
        learning_efficiency_score: learningEfficiency,
        overall_score: overallScore,
        ai_analysis: `Analysis based on ${checkins.length} days of behavioral data. Consistency: ${consistencyRate.toFixed(0)}%. Daily focus: ${avgStudyMinutes.toFixed(0)} min avg. Trend: ${studyTrend}% WoW.`,
      };

      await supabase
        .from("skill_scores")
        .upsert(scoreData, { onConflict: "user_id,score_date" });

      return new Response(JSON.stringify({ success: true, scores: scoreData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in future-predict:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
