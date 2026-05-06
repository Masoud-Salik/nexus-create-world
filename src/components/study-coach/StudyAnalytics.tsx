import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, eachDayOfInterval } from "date-fns";
import { Flame, Clock, Trophy, TrendingUp, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface AnalyticsProps {
  userId: string | null;
  isGuest: boolean;
}

interface DayData {
  date: string;
  label: string;
  minutes: number;
  level: number; // 0-4 intensity
}

interface SubjectTime {
  name: string;
  minutes: number;
  color: string;
}

interface Stats {
  totalHours: number;
  longestStreak: number;
  bestDay: string;
  bestDayMinutes: number;
  sessionsCount: number;
  avgSessionMinutes: number;
}

const COLORS_LIGHT = ["hsl(150 6% 90%)", "hsl(152 50% 80%)", "hsl(152 65% 60%)", "hsl(152 76% 42%)", "hsl(152 76% 30%)"];
const COLORS_DARK = ["hsl(150 6% 20%)", "hsl(152 40% 25%)", "hsl(152 55% 35%)", "hsl(152 70% 42%)", "hsl(152 76% 50%)"];

export function StudyAnalytics({ userId, isGuest }: AnalyticsProps) {
  const [heatmap, setHeatmap] = useState<DayData[]>([]);
  const [subjectData, setSubjectData] = useState<SubjectTime[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalHours: 0, longestStreak: 0, bestDay: "—", bestDayMinutes: 0, sessionsCount: 0, avgSessionMinutes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      loadDemoData();
      return;
    }
    if (userId) loadAnalytics();
  }, [userId, isGuest]);

  const loadDemoData = () => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 27), end: new Date() });
    const demo = days.map(d => {
      const mins = Math.random() > 0.3 ? Math.floor(Math.random() * 120 + 10) : 0;
      return {
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE"),
        minutes: mins,
        level: mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 90 ? 3 : 4,
      };
    });
    setHeatmap(demo);
    setSubjectData([
      { name: "Mathematics", minutes: 320, color: "#3b82f6" },
      { name: "Physics", minutes: 240, color: "#8b5cf6" },
      { name: "English", minutes: 180, color: "#10b981" },
    ]);
    setStats({ totalHours: 12.3, longestStreak: 7, bestDay: "Monday", bestDayMinutes: 145, sessionsCount: 24, avgSessionMinutes: 31 });
    setLoading(false);
  };

  const loadAnalytics = async () => {
    if (!userId) return;
    setLoading(true);

    const startDate = format(subDays(new Date(), 27), "yyyy-MM-dd");
    const endDate = format(new Date(), "yyyy-MM-dd");

    // Load sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("session_date, time_spent_minutes, subject_id, study_subjects(subject_name, color)")
      .eq("user_id", userId)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date");

    // Build heatmap
    const days = eachDayOfInterval({ start: subDays(new Date(), 27), end: new Date() });
    const dayMap = new Map<string, number>();
    (sessions || []).forEach((s: any) => {
      dayMap.set(s.session_date, (dayMap.get(s.session_date) || 0) + s.time_spent_minutes);
    });

    const maxMins = Math.max(...Array.from(dayMap.values()), 1);
    const hm = days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      const mins = dayMap.get(key) || 0;
      return {
        date: key,
        label: format(d, "EEE"),
        minutes: mins,
        level: mins === 0 ? 0 : Math.min(4, Math.ceil((mins / maxMins) * 4)),
      };
    });
    setHeatmap(hm);

    // Subject breakdown
    const subjMap = new Map<string, { minutes: number; color: string }>();
    (sessions || []).forEach((s: any) => {
      const name = s.study_subjects?.subject_name || "Other";
      const color = s.study_subjects?.color || "#6b7280";
      const existing = subjMap.get(name) || { minutes: 0, color };
      existing.minutes += s.time_spent_minutes;
      subjMap.set(name, existing);
    });
    setSubjectData(Array.from(subjMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minutes - a.minutes));

    // Stats
    const totalMins = (sessions || []).reduce((s: number, x: any) => s + x.time_spent_minutes, 0);
    const uniqueDays = new Set((sessions || []).map((s: any) => s.session_date));

    // Best day
    let bestDay = "—";
    let bestDayMins = 0;
    dayMap.forEach((mins, date) => {
      if (mins > bestDayMins) { bestDayMins = mins; bestDay = format(new Date(date + "T12:00:00"), "EEEE"); }
    });

    // Streak
    const { data: habitData } = await supabase
      .from("habits")
      .select("longest_streak")
      .eq("user_id", userId)
      .eq("habit_type", "study")
      .maybeSingle();

    setStats({
      totalHours: Math.round(totalMins / 6) / 10,
      longestStreak: habitData?.longest_streak || 0,
      bestDay,
      bestDayMinutes: bestDayMins,
      sessionsCount: (sessions || []).length,
      avgSessionMinutes: (sessions || []).length > 0 ? Math.round(totalMins / (sessions || []).length) : 0,
    });

    setLoading(false);
  };

  const isDark = document.documentElement.classList.contains("dark");
  const heatColors = isDark ? COLORS_DARK : COLORS_LIGHT;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
    );
  }

  const statCards = [
    { icon: Clock, label: "Total Hours", value: `${stats.totalHours}h`, color: "text-blue-500" },
    { icon: Flame, label: "Best Streak", value: `${stats.longestStreak}d`, color: "text-orange-500" },
    { icon: Trophy, label: "Best Day", value: stats.bestDay, color: "text-yellow-500" },
    { icon: TrendingUp, label: "Avg Session", value: `${stats.avgSessionMinutes}m`, color: "text-primary" },
  ];

  return (
    <div className="space-y-5 py-2">
      {/* Personal Bests */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 28-Day Activity Heatmap */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">28-Day Activity</h3>
            <span className="text-[10px] text-muted-foreground">{stats.sessionsCount} sessions</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {heatmap.slice(-28).map(d => (
              <div
                key={d.date}
                title={`${d.date}: ${d.minutes}min`}
                className="aspect-square rounded-md transition-colors"
                style={{ backgroundColor: heatColors[d.level] }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[9px] text-muted-foreground">Less</span>
            {heatColors.map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            ))}
            <span className="text-[9px] text-muted-foreground">More</span>
          </div>
        </CardContent>
      </Card>

      {/* Subject Breakdown */}
      {subjectData.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Subject Breakdown
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [`${Math.round(v / 60 * 10) / 10}h`, "Time"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={18}>
                    {subjectData.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}