import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Flame, Calendar, Clock, Loader2, UserPlus, UserMinus, TrendingUp, TrendingDown, Minus, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  unlocked: boolean;
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
  badges: Badge[];
}

interface TrendWeek {
  week_start: string;
  score: number;
  hours: number;
  days: number;
}

interface TrendsData {
  weeks: TrendWeek[];
  changes: { scoreChange: number; hoursChange: number; consistencyChange: number };
  insight: string;
}

interface LeaderboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

const TIER_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  diamond: { label: "Diamond", emoji: "💎", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" },
  gold: { label: "Gold", emoji: "🥇", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/30" },
  silver: { label: "Silver", emoji: "🥈", color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/30" },
  bronze: { label: "Bronze", emoji: "🥉", color: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/30" },
  unranked: { label: "Unranked", emoji: "⬜", color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};

function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level + 1; l++) total += 50 + l * 25;
  return total;
}

function xpForPrevLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) total += 50 + l * 25;
  return total;
}

export function Leaderboard({ open, onOpenChange, userId }: LeaderboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [computingScore, setComputingScore] = useState(false);
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [activeTab, setActiveTab] = useState("rankings");

  useEffect(() => {
    if (open && userId) {
      checkOptIn();
      loadLeaderboard();
    }
  }, [open, userId]);

  useEffect(() => {
    if (open && userId && activeTab === "trends") {
      loadTrends();
    }
  }, [open, userId, activeTab]);

  const checkOptIn = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("leaderboard_opt_ins")
      .select("display_name, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (data && data.is_active) {
      setOptedIn(true);
      setDisplayName(data.display_name);
    } else {
      setOptedIn(false);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leaderboard", {
        body: { action: "get-leaderboard" },
      });
      if (error) throw error;
      setEntries(data.leaderboard || []);
      setUserRank(data.userRank);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("leaderboard", {
        body: { action: "get-trends" },
      });
      if (error) throw error;
      setTrends(data);
    } catch (e) {
      console.error("Failed to load trends:", e);
    }
  };

  const handleJoin = async () => {
    if (!userId || !displayName.trim()) return;
    setJoining(true);
    try {
      const { error } = await supabase.from("leaderboard_opt_ins").upsert(
        { user_id: userId, display_name: displayName.trim(), is_active: true },
        { onConflict: "user_id" }
      );
      if (error) throw error;

      setOptedIn(true);
      setShowJoinForm(false);
      toast({ title: "Joined leaderboard! 🏆" });

      setComputingScore(true);
      const { data } = await supabase.functions.invoke("leaderboard", {
        body: { action: "compute-score" },
      });
      setUserScore(data?.score || null);
      setComputingScore(false);
      loadLeaderboard();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!userId) return;
    try {
      await supabase
        .from("leaderboard_opt_ins")
        .update({ is_active: false })
        .eq("user_id", userId);
      setOptedIn(false);
      setUserScore(null);
      toast({ title: "Left leaderboard" });
      loadLeaderboard();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRefreshScore = async () => {
    setComputingScore(true);
    try {
      const { data } = await supabase.functions.invoke("leaderboard", {
        body: { action: "compute-score" },
      });
      setUserScore(data?.score || null);
      await loadLeaderboard();
      toast({ title: "Score updated!" });
    } catch (e) {
      console.error(e);
    } finally {
      setComputingScore(false);
    }
  };

  const tierConfig = (tier: string) => TIER_CONFIG[tier] || TIER_CONFIG.unranked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Weekly Leaderboard
          </DialogTitle>
        </DialogHeader>

        {/* Opt-in Controls */}
        {!optedIn && !showJoinForm && (
          <Button onClick={() => setShowJoinForm(true)} className="gap-2 w-full">
            <UserPlus className="h-4 w-4" />
            Join Leaderboard
          </Button>
        )}

        {showJoinForm && !optedIn && (
          <div className="flex gap-2">
            <Input
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
            />
            <Button onClick={handleJoin} disabled={joining || !displayName.trim()}>
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
            </Button>
          </div>
        )}

        {optedIn && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Playing as <span className="font-medium text-foreground">{displayName}</span>
              {userRank && ` · #${userRank}`}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleRefreshScore} disabled={computingScore}>
                {computingScore ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLeave} className="text-destructive">
                <UserMinus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* User Score Card */}
        {userScore && (
          <UserScoreCard score={userScore} tierConfig={tierConfig} />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings" className="mt-3">
            <RankingsTab loading={loading} entries={entries} tierConfig={tierConfig} />
          </TabsContent>

          <TabsContent value="badges" className="mt-3">
            <BadgesTab badges={userScore?.badges || []} />
          </TabsContent>

          <TabsContent value="trends" className="mt-3">
            <TrendsTab trends={trends} />
          </TabsContent>
        </Tabs>

        {/* Score Formula */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1 mt-2">
          <p className="font-medium text-foreground text-sm">Scoring Breakdown</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>📅 30% Consistency</span>
            <span>🔥 25% Streak</span>
            <span>⏱ 20% Hours</span>
            <span>✅ 15% Tasks</span>
            <span>💪 10% Difficulty</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ── */

function UserScoreCard({ score, tierConfig }: { score: UserScore; tierConfig: (t: string) => typeof TIER_CONFIG[string] }) {
  const tc = tierConfig(score.tier);
  const xpNext = xpForLevel(score.level);
  const xpPrev = xpForPrevLevel(score.level);
  const progress = xpNext > xpPrev ? ((score.xp - xpPrev) / (xpNext - xpPrev)) * 100 : 0;

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", tc.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tc.emoji}</span>
          <div>
            <p className={cn("font-bold text-sm", tc.color)}>{tc.label} Tier</p>
            <p className="text-xs text-muted-foreground">Level {score.level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">{score.discipline_score}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pts</p>
        </div>
      </div>

      {/* XP Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{score.xp} XP</span>
          <span>{xpNext} XP for Lv.{score.level + 1}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{score.study_hours}h</p>
          <p className="text-[10px] text-muted-foreground">Hours</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{score.streak_days}</p>
          <p className="text-[10px] text-muted-foreground">Streak</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{score.days_studied}/7</p>
          <p className="text-[10px] text-muted-foreground">Days</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{score.task_completion_rate}%</p>
          <p className="text-[10px] text-muted-foreground">Tasks</p>
        </div>
      </div>
    </div>
  );
}

function RankingsTab({ loading, entries, tierConfig }: { loading: boolean; entries: LeaderboardEntry[]; tierConfig: (t: string) => typeof TIER_CONFIG[string] }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No rankings yet this week</p>
        <p className="text-xs text-muted-foreground mt-1">Join and study to appear here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const tc = tierConfig(entry.tier);
        return (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              entry.is_current_user
                ? "bg-primary/5 border-primary/30 scale-[1.01]"
                : "border-border hover:bg-muted/30",
              entry.rank <= 3 && "border-yellow-500/20"
            )}
          >
            {/* Rank */}
            <div className="w-8 text-center font-bold text-lg shrink-0">
              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {entry.country && (
                  <img 
                    src={`https://flagcdn.com/w20/${entry.country.toLowerCase()}.png`}
                    alt={entry.country}
                    className="h-4 w-5 rounded-sm object-cover shrink-0"
                  />
                )}
                <p className={cn(
                  "font-medium text-sm truncate",
                  entry.is_current_user && "text-primary"
                )}>
                  {entry.display_name}
                  {entry.is_current_user && " (You)"}
                </p>
                <span className="text-xs">{tc.emoji}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />{entry.days_studied}d
                </span>
                <span className="flex items-center gap-0.5">
                  <Flame className="h-3 w-3 text-orange-500" />{entry.streak_days}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />{entry.study_hours}h
                </span>
                <span className="text-[10px] text-muted-foreground">Lv.{entry.level}</span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground">{entry.discipline_score}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BadgesTab({ badges }: { badges: Badge[] }) {
  const unlocked = badges.filter(b => b.unlocked);
  const locked = badges.filter(b => !b.unlocked);

  if (badges.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Refresh your score to see badges</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unlocked.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Unlocked ({unlocked.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {unlocked.map(b => (
              <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-xl">{b.emoji}</span>
                <p className="text-xs font-medium text-foreground">{b.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Locked ({locked.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {locked.map(b => (
              <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border opacity-50">
                <span className="text-xl grayscale">🔒</span>
                <p className="text-xs text-muted-foreground">{b.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendsTab({ trends }: { trends: TrendsData | null }) {
  if (!trends) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (trends.weeks.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No history yet. Keep studying!</p>
      </div>
    );
  }

  const { changes, insight } = trends;

  const ChangeIndicator = ({ value, unit }: { value: number; unit: string }) => (
    <span className={cn(
      "flex items-center gap-0.5 text-xs font-medium",
      value > 0 ? "text-green-500" : value < 0 ? "text-destructive" : "text-muted-foreground"
    )}>
      {value > 0 ? <TrendingUp className="h-3 w-3" /> : value < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {value > 0 ? "+" : ""}{value}{unit}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Insight */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-foreground">
        {insight}
      </div>

      {/* Week-over-week changes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Score</p>
          <ChangeIndicator value={changes.scoreChange} unit=" pts" />
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Hours</p>
          <ChangeIndicator value={changes.hoursChange} unit="h" />
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Days</p>
          <ChangeIndicator value={changes.consistencyChange} unit="d" />
        </div>
      </div>

      {/* Mini bar chart */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Weekly Scores</p>
        <div className="flex items-end gap-2 h-20">
          {trends.weeks.map((w, i) => {
            const maxScore = Math.max(...trends.weeks.map(wk => wk.score), 1);
            const height = (w.score / maxScore) * 100;
            const isLatest = i === trends.weeks.length - 1;
            return (
              <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-foreground">{w.score}</span>
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all",
                    isLatest ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {new Date(w.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
