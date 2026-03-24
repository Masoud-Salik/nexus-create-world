import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Brain, Target, Zap, TrendingUp, Loader2 } from "lucide-react";
import type { SkillScore } from "@/pages/TheFuture";

interface SkillScoresProps {
  scores: SkillScore | null;
  onCalculate: () => void;
  loading: boolean;
}

const skillConfig = [
  {
    key: "discipline_score" as const,
    label: "Discipline",
    icon: Target,
    description: "Consistency in daily check-ins",
  },
  {
    key: "consistency_score" as const,
    label: "Consistency",
    icon: TrendingUp,
    description: "Regular study sessions",
  },
  {
    key: "focus_score" as const,
    label: "Focus",
    icon: Zap,
    description: "Average study duration",
  },
  {
    key: "learning_efficiency_score" as const,
    label: "Learning Efficiency",
    icon: Brain,
    description: "Accuracy in study sessions",
  },
];

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  return "Needs Work";
}

export function SkillScores({ scores, onCalculate, loading }: SkillScoresProps) {
  if (!scores) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Skill Analysis</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Calculate your skill scores based on your daily check-ins and study sessions.
          </p>
          <Button onClick={onCalculate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Analyze My Skills
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${getScoreColor(scores.overall_score)}`}>
                  {scores.overall_score}
                </span>
                <span className="text-muted-foreground">/100</span>
              </div>
              <p className={`text-sm font-medium ${getScoreColor(scores.overall_score)}`}>
                {getScoreLabel(scores.overall_score)}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={onCalculate} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Skills */}
      <div className="grid gap-3 md:grid-cols-2">
        {skillConfig.map((skill) => {
          const score = scores[skill.key];
          const Icon = skill.icon;

          return (
            <Card key={skill.key}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className={`h-4 w-4 ${getScoreColor(score)}`} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{skill.label}</p>
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                        {score}
                      </span>
                    </div>
                    <Progress 
                      value={score} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Analysis */}
      {scores.ai_analysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{scores.ai_analysis}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
