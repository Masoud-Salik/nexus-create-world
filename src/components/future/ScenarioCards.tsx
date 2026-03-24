import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, TrendingUp, TrendingDown, Minus, 
  Lightbulb, AlertTriangle, Target, Clock, Loader2 
} from "lucide-react";
import type { FutureScenario } from "@/pages/TheFuture";

interface ScenarioCardsProps {
  scenarios: FutureScenario[];
  selectedTimeframe: "1_year" | "3_years" | "5_years";
  onTimeframeChange: (tf: "1_year" | "3_years" | "5_years") => void;
  onGenerate: () => void;
  generating: boolean;
}

const timeframeLabels = {
  "1_year": "1 Year",
  "3_years": "3 Years",
  "5_years": "5 Years",
};

const scenarioConfig = {
  best_case: {
    icon: TrendingUp,
    color: "text-green-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    label: "Best Case",
    description: "If you maximize your potential",
  },
  realistic: {
    icon: Minus,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Realistic",
    description: "Most likely outcome",
  },
  worst_case: {
    icon: TrendingDown,
    color: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Worst Case",
    description: "If current problems persist",
  },
};

export function ScenarioCards({
  scenarios,
  selectedTimeframe,
  onTimeframeChange,
  onGenerate,
  generating,
}: ScenarioCardsProps) {
  return (
    <div className="space-y-4">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          {(["1_year", "3_years", "5_years"] as const).map((tf) => (
            <Button
              key={tf}
              variant={selectedTimeframe === tf ? "default" : "outline"}
              size="sm"
              onClick={() => onTimeframeChange(tf)}
              className="gap-1"
            >
              <Clock className="h-3 w-3" />
              {timeframeLabels[tf]}
            </Button>
          ))}
        </div>
        <Button onClick={onGenerate} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {scenarios.length > 0 ? "Regenerate" : "Generate Scenarios"}
        </Button>
      </div>

      {/* Scenarios */}
      {scenarios.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Scenarios Yet</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Generate AI-powered future predictions based on your profile, goals, and daily progress data.
            </p>
            <Button onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Your Future
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(["best_case", "realistic", "worst_case"] as const).map((type) => {
            const scenario = scenarios.find((s) => s.scenario_type === type);
            if (!scenario) return null;

            const config = scenarioConfig[type];
            const Icon = config.icon;

            return (
              <Card key={type} className={`${config.border} border-2 overflow-hidden`}>
                <CardHeader className={`${config.bg} pb-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <CardTitle className="text-base">{scenario.title}</CardTitle>
                        <CardDescription className="text-xs">{config.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      {scenario.probability_score}% likely
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm text-foreground leading-relaxed">{scenario.description}</p>

                  {/* Skills Gained */}
                  {scenario.skills_gained?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Target className="h-3 w-3" /> Skills Gained
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {scenario.skills_gained.map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opportunities */}
                  {scenario.opportunities?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> Opportunities
                      </p>
                      <ul className="text-sm text-foreground space-y-1">
                        {scenario.opportunities.map((opp, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {scenario.risks?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Risks
                      </p>
                      <ul className="text-sm text-foreground space-y-1">
                        {scenario.risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {scenario.recommendations?.length > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs font-medium text-primary mb-2">Recommendations</p>
                      <ul className="text-sm space-y-1">
                        {scenario.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">{i + 1}.</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
