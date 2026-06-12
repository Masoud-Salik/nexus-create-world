import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { xpFromSession, levelFromXp } from "@/utils/xp";

export interface StudyProgress {
  todayMinutes: number;
  weekMinutesPerDay: number[]; // length 7, oldest -> newest (today last)
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpForLevel: number;
  dailyGoalMinutes: number;
  quests: { id: string; label: string; done: boolean }[];
  questsDone: number;
  loading: boolean;
}

const DEFAULT: StudyProgress = {
  todayMinutes: 0,
  weekMinutesPerDay: [0, 0, 0, 0, 0, 0, 0],
  totalXp: 0,
  level: 1,
  xpInLevel: 0,
  xpForLevel: 50,
  dailyGoalMinutes: 60,
  quests: [
    { id: "task", label: "Complete 1 task", done: false },
    { id: "deep", label: "30+ min focus block", done: false },
    { id: "clean", label: "0 distractions in a block", done: false },
  ],
  questsDone: 0,
  loading: true,
};

export function useStudyProgress(userId: string | null, isGuest: boolean) {
  const [progress, setProgress] = useState<StudyProgress>(DEFAULT);

  const compute = useCallback(async () => {
    if (!userId || isGuest) {
      setProgress({ ...DEFAULT, loading: false });
      return;
    }
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");

      // Pull sessions in window + lifetime XP sample (cap 500 rows)
      const [{ data: weekSess }, { data: lifeSess }, { data: completedToday }, { data: checkins }] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("time_spent_minutes, session_date, notes, is_bonus")
          .eq("user_id", userId)
          .gte("session_date", weekStart),
        supabase
          .from("study_sessions")
          .select("time_spent_minutes, notes, is_bonus")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("study_tasks")
          .select("id, status")
          .eq("user_id", userId)
          .eq("task_date", today)
          .eq("status", "completed"),
        supabase
          .from("daily_checkins")
          .select("study_minutes")
          .eq("user_id", userId)
          .order("checkin_date", { ascending: false })
          .limit(14),
      ]);

      // Week heatmap
      const days: number[] = Array(7).fill(0);
      (weekSess || []).forEach((s: any) => {
        const idx = 6 - Math.min(6, Math.max(0, Math.floor(
          (Date.parse(today) - Date.parse(s.session_date)) / 86400000
        )));
        days[idx] += s.time_spent_minutes || 0;
      });
      const todayMinutes = days[6];

      // Lifetime XP from sessions (estimate from minutes when no score in notes)
      const totalXp = (lifeSess || []).reduce((acc: number, s: any) => {
        const score = parseNoteScore(s.notes);
        return acc + xpFromSession({
          minutes: s.time_spent_minutes || 0,
          focusScore: score ?? 70,
          bonus: !!s.is_bonus,
        });
      }, 0);
      const lvl = levelFromXp(totalXp);

      // Quests
      const todaySessions = (weekSess || []).filter((s: any) => s.session_date === today);
      const deepBlock = todaySessions.some((s: any) => (s.time_spent_minutes || 0) >= 30);
      const cleanBlock = todaySessions.some((s: any) => {
        const d = parseNoteDistractions(s.notes);
        return d === 0 && (s.time_spent_minutes || 0) >= 15;
      });
      const taskDone = (completedToday?.length || 0) >= 1;

      const quests = [
        { id: "task", label: "Complete 1 task", done: taskDone },
        { id: "deep", label: "30+ min focus block", done: deepBlock },
        { id: "clean", label: "0-distraction block", done: cleanBlock },
      ];

      // Daily goal: median of last 14 days study_minutes, fallback 60
      const mins = (checkins || []).map((c: any) => c.study_minutes).filter((n: number) => n > 0).sort((a, b) => a - b);
      const median = mins.length ? mins[Math.floor(mins.length / 2)] : 60;
      const dailyGoalMinutes = Math.max(30, Math.min(240, median));

      setProgress({
        todayMinutes,
        weekMinutesPerDay: days,
        totalXp,
        level: lvl.level,
        xpInLevel: lvl.xpInLevel,
        xpForLevel: lvl.xpForLevel,
        dailyGoalMinutes,
        quests,
        questsDone: quests.filter((q) => q.done).length,
        loading: false,
      });
    } catch (e) {
      console.error("useStudyProgress error", e);
      setProgress((p) => ({ ...p, loading: false }));
    }
  }, [userId, isGuest]);

  useEffect(() => { compute(); }, [compute]);

  return { progress, refresh: compute };
}

function parseNoteScore(note?: string | null): number | null {
  if (!note) return null;
  const m = /s:(\d+)/.exec(note);
  return m ? parseInt(m[1], 10) : null;
}
function parseNoteDistractions(note?: string | null): number | null {
  if (!note) return null;
  const m = /d:(\d+)/.exec(note);
  return m ? parseInt(m[1], 10) : null;
}

// Encode session metadata into the `notes` column without schema changes.
export function encodeSessionNote(opts: {
  intent?: string;
  distractions?: number;
  focusScore?: number;
}): string {
  const parts: string[] = [];
  if (opts.intent) parts.push(`i:${opts.intent.slice(0, 60).replace(/\|/g, "")}`);
  if (typeof opts.distractions === "number") parts.push(`d:${opts.distractions}`);
  if (typeof opts.focusScore === "number") parts.push(`s:${Math.round(opts.focusScore)}`);
  return parts.join("|");
}