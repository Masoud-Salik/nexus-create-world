import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Loader2, RefreshCw, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Components
import { FutureHeader } from "@/components/future/FutureHeader";
import { DailyCoach } from "@/components/future/DailyCoach";
import { ProfileSetup } from "@/components/future/ProfileSetup";

export interface FutureScenario {
  id: string;
  timeframe: string;
  scenario_type: "best_case" | "realistic" | "worst_case";
  title: string;
  description: string;
  skills_gained: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  probability_score: number;
}

export interface SkillScore {
  discipline_score: number;
  consistency_score: number;
  focus_score: number;
  learning_efficiency_score: number;
  overall_score: number;
  ai_analysis: string;
}

export interface WeeklyReportData {
  progress_trend: "improving" | "stable" | "declining";
  summary: string;
  main_reason: string;
  action_items: string[];
  study_hours_logged: number;
  consistency_percentage: number;
  compared_to_high_performers: string;
}

export interface DailyCoachMessage {
  priority_focus: string;
  warning_message: string | null;
  motivation_level: "low" | "medium" | "high";
}

const timeframeLabels = {
  "1_year": "1 Year",
  "3_years": "3 Years",
  "5_years": "5 Years",
};

const scenarioConfig = {
  best_case: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-500/10", label: "Best Case" },
  realistic: { icon: Minus, color: "text-blue-600", bg: "bg-blue-500/10", label: "Realistic" },
  worst_case: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-500/10", label: "Worst Case" },
};

export default function TheFuture() {
  usePageMeta({ title: "The Future", description: "AI-powered future predictions." });
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const autoGenerateAttempted = useRef(false);
  
  // Data states
  const [scenarios, setScenarios] = useState<FutureScenario[]>([]);
  const [skillScores, setSkillScores] = useState<SkillScore | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [dailyCoach, setDailyCoach] = useState<DailyCoachMessage | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1_year" | "3_years" | "5_years">("1_year");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userId && profileComplete) {
      loadAllData();
    }
  }, [userId, profileComplete, selectedTimeframe]);

  useEffect(() => {
    if (userId && profileComplete && !autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      autoGenerateInsights();
    }
  }, [userId, profileComplete]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, age, country, education_level, field_of_interest")
      .eq("id", user.id)
      .single();

    if (profile) {
      const isComplete = Boolean(
        profile.name && profile.age && profile.country && 
        profile.education_level && profile.field_of_interest
      );
      setProfileComplete(isComplete);
    }
    setLoading(false);
  };

  const loadAllData = async () => {
    if (!userId) return;

    try {
      const [scenariosRes, scoresRes, reportRes, coachRes] = await Promise.all([
        supabase.from("future_scenarios").select("*").eq("user_id", userId).eq("timeframe", selectedTimeframe).order("created_at", { ascending: false }),
        supabase.from("skill_scores").select("*").eq("user_id", userId).order("score_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("weekly_reports").select("*").eq("user_id", userId).order("week_start", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("daily_coach_messages").select("*").eq("user_id", userId).eq("message_date", new Date().toISOString().split("T")[0]).maybeSingle(),
      ]);

      setScenarios((scenariosRes.data as FutureScenario[]) || []);
      setSkillScores(scoresRes.data as SkillScore | null);
      setWeeklyReport(reportRes.data as WeeklyReportData | null);
      setDailyCoach(coachRes.data as DailyCoachMessage | null);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const autoGenerateInsights = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];
    
    const [scenariosCheck, coachCheck] = await Promise.all([
      supabase.from("future_scenarios").select("id").eq("user_id", userId).limit(1),
      supabase.from("daily_coach_messages").select("id").eq("user_id", userId).eq("message_date", today).limit(1),
    ]);

    if (!scenariosCheck.data?.length || !coachCheck.data?.length) {
      setGenerating(true);
      try {
        await Promise.all([
          !scenariosCheck.data?.length && supabase.functions.invoke("future-predict", { body: { action: "generate-scenarios", timeframe: "1_year" } }),
          !coachCheck.data?.length && supabase.functions.invoke("future-predict", { body: { action: "generate-daily-coach" } }),
        ].filter(Boolean));
        
        toast({ title: "Insights Generated" });
        loadAllData();
      } catch (error) {
        console.error("Error auto-generating:", error);
      } finally {
        setGenerating(false);
      }
    }
  };

  const generateScenarios = async () => {
    if (!userId) return;
    setGenerating(true);

    try {
      await supabase.functions.invoke("future-predict", {
        body: { action: "generate-scenarios", timeframe: selectedTimeframe },
      });
      toast({ title: "Scenarios generated!" });
      loadAllData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate scenarios", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const generateDailyCoach = async () => {
    if (!userId) return;
    setGenerating(true);

    try {
      await supabase.functions.invoke("future-predict", {
        body: { action: "generate-daily-coach" },
      });
      toast({ title: "Coach message updated!" });
      loadAllData();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const refreshAll = async () => {
    if (!userId) return;
    setGenerating(true);

    try {
      await Promise.all([
        supabase.functions.invoke("future-predict", { body: { action: "generate-scenarios", timeframe: selectedTimeframe } }),
        supabase.functions.invoke("future-predict", { body: { action: "generate-daily-coach" } }),
        supabase.functions.invoke("future-predict", { body: { action: "calculate-skill-scores" } }),
      ]);
      toast({ title: "All insights refreshed!" });
      loadAllData();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileComplete) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4">
          <FutureHeader />
          <ProfileSetup userId={userId!} onComplete={() => setProfileComplete(true)} />
        </div>
      </div>
    );
  }

  const currentScenario = scenarios.find(s => s.scenario_type === "realistic") || scenarios[0];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <FutureHeader />
          <Button variant="ghost" size="icon" onClick={refreshAll} disabled={generating}>
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Daily Coach */}
        <DailyCoach data={dailyCoach} onRefresh={generateDailyCoach} loading={generating} />

        {/* Overall Score */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overall Score</p>
                <p className="text-3xl font-bold text-primary">{skillScores?.overall_score || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Consistency</p>
                <p className="text-xl font-semibold">{skillScores?.consistency_score || weeklyReport?.consistency_percentage || 0}%</p>
              </div>
            </div>
            {skillScores && (
              <Progress value={skillScores.overall_score} className="h-2 mt-3" />
            )}
          </CardContent>
        </Card>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(["1_year", "3_years", "5_years"] as const).map((tf) => (
            <Button
              key={tf}
              variant={selectedTimeframe === tf ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeframe(tf)}
              className="flex-1 gap-1"
            >
              <Clock className="h-3 w-3" />
              {timeframeLabels[tf]}
            </Button>
          ))}
        </div>

        {/* Scenario Cards - One at a time */}
        {scenarios.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Generate AI-powered future predictions</p>
              <Button onClick={generateScenarios} disabled={generating}>
                {generating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Generate Scenarios
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(["best_case", "realistic", "worst_case"] as const).map((type) => {
              const scenario = scenarios.find(s => s.scenario_type === type);
              if (!scenario) return null;
              
              const config = scenarioConfig[type];
              const Icon = config.icon;

              return (
                <Card key={type} className="overflow-hidden">
                  <CardHeader className={`py-3 px-4 ${config.bg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <CardTitle className="text-sm">{config.label}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {scenario.probability_score}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-1">{scenario.title}</p>
                    <p className="text-xs text-muted-foreground">{scenario.description}</p>
                    
                    {scenario.recommendations?.length > 0 && (
                      <div className="mt-3 p-2 rounded bg-muted/50">
                        <p className="text-xs font-medium text-primary mb-1">Action:</p>
                        <p className="text-xs text-muted-foreground">{scenario.recommendations[0]}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Weekly Summary */}
        {weeklyReport && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Weekly Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-xs text-muted-foreground">{weeklyReport.summary}</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                <div>
                  <p className="text-lg font-bold">{weeklyReport.study_hours_logged.toFixed(1)}h</p>
                  <p className="text-[10px] text-muted-foreground">Study time</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{weeklyReport.consistency_percentage}%</p>
                  <p className="text-[10px] text-muted-foreground">Consistency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
