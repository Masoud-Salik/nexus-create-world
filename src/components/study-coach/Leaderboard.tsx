import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Loader2, Medal, TrendingUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  study_hours: number;
  streak_days: number;
  discipline_score: number;
  level: number;
  tier: string;
  is_current_user: boolean;
}

interface UserScore {
  discipline_score: number;
  study_hours: number;
  streak_days: number;
  level: number;
  tier: string;
  rank: number;
}

interface LeaderboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

function getTierConfig(tier: string) {
  switch (tier) {
    case "diamond": return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-400/10" };
    case "gold": return { label: "Gold", color: "text-yellow-500", bg: "bg-yellow-500/10" };
    case "silver": return { label: "Silver", color: "text-gray-400", bg: "bg-gray-400/10" };
    case "bronze": return { label: "Bronze", color: "text-orange-600", bg: "bg-orange-600/10" };
    default: return { label: "Starter", color: "text-muted-foreground", bg: "bg-muted" };
  }
}

function RankingsTab({ loading, entries }: { loading: boolean; entries: LeaderboardEntry[] }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">No rankings yet</p>
        <p className="text-xs text-muted-foreground mt-1">Join and study to appear here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const tc = getTierConfig(entry.tier);
        return (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              entry.is_current_user ? "bg-primary/5 border-primary/30" : "border-border"
            )}
          >
            <div className="w-8 text-center font-bold">
              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {entry.display_name}
                {entry.is_current_user && " (You)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.study_hours}h • {entry.streak_days}🔥 • Lv.{entry.level}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{entry.discipline_score}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserScoreCard({ score }: { score: UserScore }) {
  const tc = getTierConfig(score.tier);
  return (
    <div className="space-y-4">
      <div className="text-center p-6 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-4xl font-bold text-primary">{score.discipline_score}</p>
        <p className="text-sm text-muted-foreground mt-1">Discipline Score</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{score.study_hours}h</p>
          <p className="text-[10px] text-muted-foreground">Study</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Flame className="h-4 w-4 mx-auto mb-1 text-orange-500" />
          <p className="text-lg font-bold">{score.streak_days}</p>
          <p className="text-[10px] text-muted-foreground">Streak</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Medal className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
          <p className="text-lg font-bold">Lv.{score.level}</p>
          <p className="text-[10px] text-muted-foreground">Level</p>
        </div>
      </div>
      <div className={cn("text-center text-sm font-medium py-2 rounded-lg", tc.bg, tc.color)}>
        {tc.label} Tier — Rank #{score.rank}
      </div>
    </div>
  );
}

export function Leaderboard({ open, onOpenChange, userId }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState("rankings");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState<UserScore | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leaderboard", {
        body: { userId }
      });

      if (error) throw error;
      if (data?.entries) setEntries(data.entries);
      if (data?.userScore) setUserScore(data.userScore);
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) loadLeaderboard();
  }, [open, loadLeaderboard]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={loadLeaderboard} className="gap-1">
              <Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
            <TabsTrigger value="progress">✨ My Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings" className="mt-3">
            <RankingsTab loading={loading} entries={entries} />
          </TabsContent>

          <TabsContent value="progress" className="mt-3">
            {userScore ? (
              <UserScoreCard score={userScore} />
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Join leaderboard to track your progress
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
