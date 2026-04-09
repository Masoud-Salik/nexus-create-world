import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Loader2, TrendingUp, TrendingDown, Flame, BookOpen, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Country code → flag emoji
function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  study_hours: number;
  streak_days: number;
  days_studied: number;
  discipline_score: number;
  is_current_user: boolean;
  tier: string;
  xp: number;
  level: number;
  country?: string;
  is_studying?: boolean;
}

interface UserScore {
  study_hours: number;
  streak_days: number;
  days_studied: number;
  discipline_score: number;
  tasks_completed: number;
  total_tasks: number;
  task_completion_rate: number;
  tier: string;
  xp: number;
  level: number;
  badges: { id: string; name: string; emoji: string; unlocked: boolean }[];
}

interface TrendData {
  weeks: { week_start: string; score: number; hours: number; days: number }[];
  changes: { scoreChange: number; hoursChange: number; consistencyChange: number };
  insight: string;
}

interface LeaderboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

function getTierConfig(tier: string) {
  switch (tier) {
    case "diamond": return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/30", emoji: "💎" };
    case "gold": return { label: "Gold", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", emoji: "🥇" };
    case "silver": return { label: "Silver", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/30", emoji: "🥈" };
    case "bronze": return { label: "Bronze", color: "text-orange-600", bg: "bg-orange-600/10", border: "border-orange-600/30", emoji: "🥉" };
    default: return { label: "Unranked", color: "text-muted-foreground", bg: "bg-muted", border: "border-border", emoji: "⭐" };
  }
}

function xpForLevel(level: number): number {
  let threshold = 0;
  for (let l = 1; l < level; l++) threshold += 50 + (l + 1) * 25;
  return threshold;
}

function xpForNextLevel(level: number): number {
  return 50 + (level + 1) * 25;
}

// --- Header Card ---
function HeaderCard({ score, userRank }: { score: UserScore | null; userRank: number | null }) {
  if (!score) return null;
  const tc = getTierConfig(score.tier);
  const currentLevelXP = xpForLevel(score.level);
  const nextLevelXP = xpForNextLevel(score.level);
  const xpInLevel = score.xp - currentLevelXP;
  const progress = Math.min((xpInLevel / nextLevelXP) * 100, 100);

  return (
    <div className={cn("rounded-2xl border p-4 mb-4", tc.border, tc.bg)}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{tc.emoji}</span>
        <div className="flex-1">
          <p className={cn("text-sm font-bold", tc.color)}>{tc.label} Tier • Level {score.level}</p>
          <p className="text-xs text-muted-foreground">Rank #{userRank || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-foreground">{score.discipline_score}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PTS</p>
        </div>
      </div>
      {/* XP Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{score.xp} XP</span>
          <span>{currentLevelXP + nextLevelXP} XP</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { icon: BookOpen, value: `${score.study_hours}h`, label: "Hours" },
          { icon: Flame, value: `${score.streak_days}`, label: "Streak" },
          { icon: Calendar, value: `${score.days_studied}`, label: "Days" },
          { icon: CheckCircle2, value: `${score.task_completion_rate}%`, label: "Tasks" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center">
            <s.icon className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Rankings ---
function RankingsTab({ loading, entries }: { loading: boolean; entries: LeaderboardEntry[] }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!entries.length) return (
    <div className="text-center py-10">
      <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">No rankings yet</p>
    </div>
  );

  // Top 3 highlights
  const top3 = entries.slice(0, 3);
  const topStreak = [...entries].sort((a, b) => b.streak_days - a.streak_days)[0];
  const topHours = [...entries].sort((a, b) => b.study_hours - a.study_hours)[0];
  const topConsistency = [...entries].sort((a, b) => b.days_studied - a.days_studied)[0];

  return (
    <div className="space-y-3">
      {/* Highlight cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "TOP STREAK", user: topStreak, value: `${topStreak?.streak_days || 0}d 🔥`, bg: "bg-orange-500/10" },
          { label: "MOST HOURS", user: topHours, value: `${topHours?.study_hours || 0}h 📚`, bg: "bg-blue-500/10" },
          { label: "CONSISTENCY", user: topConsistency, value: `${topConsistency?.days_studied || 0}d ⭐`, bg: "bg-green-500/10" },
        ].map(h => (
          <div key={h.label} className={cn("rounded-xl p-2.5 text-center", h.bg)}>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{h.label}</p>
            <p className="text-xs font-medium truncate">{countryFlag(h.user?.country)} {h.user?.display_name || "—"}</p>
            <p className="text-sm font-bold text-foreground">{h.value}</p>
          </div>
        ))}
      </div>

      {/* Player rows */}
      <div className="space-y-1.5">
        {entries.map(entry => {
          const tc = getTierConfig(entry.tier);
          return (
            <div
              key={`${entry.rank}-${entry.display_name}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors",
                entry.is_current_user ? "bg-primary/5 border-primary/30" : "border-border/50 hover:bg-muted/30"
              )}
            >
              {/* Rank */}
              <div className="w-7 text-center font-bold text-sm shrink-0">
                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
              </div>
              {/* Flag + Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{countryFlag(entry.country)}</span>
                  <span className="text-sm font-medium truncate">
                    {entry.display_name}{entry.is_current_user && " (You)"}
                  </span>
                  {entry.is_studying && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {entry.study_hours}h • {entry.streak_days}🔥 • Lv.{entry.level}
                </p>
              </div>
              {/* Score */}
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">{entry.discipline_score}</p>
                <p className={cn("text-[9px] font-medium", tc.color)}>{tc.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Progress Tab ---
function ProgressTab({ score, trends, loading }: { score: UserScore | null; trends: TrendData | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!score) return <div className="text-center py-6 text-sm text-muted-foreground">Study to see your progress</div>;

  const unlockedBadges = score.badges.filter(b => b.unlocked);
  const maxScore = Math.max(...(trends?.weeks.map(w => w.score) || [1]), 1);

  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-foreground">Badges</p>
          <p className="text-[10px] text-muted-foreground">{unlockedBadges.length}/{score.badges.length} unlocked</p>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div className="h-full bg-primary rounded-full" style={{ width: `${(unlockedBadges.length / score.badges.length) * 100}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {score.badges.map(b => (
            <div key={b.id} className={cn("text-center py-1.5 rounded-lg transition-all", b.unlocked ? "bg-primary/10" : "bg-muted/50 opacity-40")}>
              <span className="text-lg">{b.emoji}</span>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight">{b.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Trend Chart */}
      {trends && trends.weeks.length > 0 && (
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-bold text-foreground mb-3">Weekly Trend</p>
          <div className="flex items-end gap-2 h-20">
            {trends.weeks.map((w, i) => {
              const h = Math.max((w.score / maxScore) * 100, 8);
              const isLast = i === trends.weeks.length - 1;
              return (
                <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-foreground">{w.score}</span>
                  <div className={cn("w-full rounded-t-md transition-all", isLast ? "bg-primary" : "bg-muted-foreground/20")} style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-muted-foreground">W{i + 1}</span>
                </div>
              );
            })}
          </div>
          {/* Changes */}
          {trends.changes && (
            <div className="flex gap-3 mt-3 pt-2 border-t border-border/50">
              {[
                { label: "Score", val: trends.changes.scoreChange },
                { label: "Hours", val: trends.changes.hoursChange },
                { label: "Days", val: trends.changes.consistencyChange },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-1 text-[10px]">
                  {c.val > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : c.val < 0 ? <TrendingDown className="h-3 w-3 text-red-500" /> : null}
                  <span className={cn("font-medium", c.val > 0 ? "text-green-500" : c.val < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {c.val > 0 ? "+" : ""}{c.val} {c.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insight */}
      {trends?.insight && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs text-foreground">{trends.insight}</p>
        </div>
      )}
    </div>
  );
}

export function Leaderboard({ open, onOpenChange, userId }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState("rankings");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Compute score first
      const { data: scoreData } = await supabase.functions.invoke("leaderboard", {
        body: { action: "compute-score" },
      });
      if (scoreData?.score) setUserScore(scoreData.score);

      // Get leaderboard
      const { data: lbData } = await supabase.functions.invoke("leaderboard", {
        body: { action: "get-leaderboard" },
      });
      if (lbData?.leaderboard) setEntries(lbData.leaderboard);
      if (lbData?.userRank) setUserRank(lbData.userRank);

      // Get trends
      const { data: trendData } = await supabase.functions.invoke("leaderboard", {
        body: { action: "get-trends" },
      });
      if (trendData) setTrends(trendData);
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-4">
        <DialogHeader className="space-y-1 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Standing
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={load} className="gap-1 h-8">
              <Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <HeaderCard score={userScore} userRank={userRank} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
            <TabsTrigger value="progress">✨ My Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="rankings" className="mt-3">
            <RankingsTab loading={loading} entries={entries} />
          </TabsContent>
          <TabsContent value="progress" className="mt-3">
            <ProgressTab score={userScore} trends={trends} loading={loading} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
