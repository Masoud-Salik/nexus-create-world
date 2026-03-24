import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, Minus, Clock, Target, 
  AlertCircle, CheckCircle2, RefreshCw, Loader2, Users
} from "lucide-react";
import type { WeeklyReportData } from "@/pages/TheFuture";

interface WeeklyReportProps {
  report: WeeklyReportData | null;
  onGenerate: () => void;
  loading: boolean;
}

const trendConfig = {
  improving: {
    icon: TrendingUp,
    color: "text-green-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    label: "Improving",
  },
  stable: {
    icon: Minus,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Stable",
  },
  declining: {
    icon: TrendingDown,
    color: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Declining",
  },
};

export function WeeklyReport({ report, onGenerate, loading }: WeeklyReportProps) {
  if (!report) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Weekly Progress Report</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Generate an honest AI analysis of your weekly progress with actionable insights.
          </p>
          <Button onClick={onGenerate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  const trend = trendConfig[report.progress_trend];
  const TrendIcon = trend.icon;

  return (
    <div className="space-y-4">
      {/* Progress Trend Card */}
      <Card className={`${trend.border} border-2`}>
        <CardHeader className={`${trend.bg} pb-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendIcon className={`h-6 w-6 ${trend.color}`} />
              <div>
                <CardTitle className="text-lg">{trend.label}</CardTitle>
                <p className="text-sm text-muted-foreground">Your weekly trend</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onGenerate} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-foreground leading-relaxed">{report.summary}</p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{report.study_hours_logged.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Study hours logged</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm">Consistency</span>
                </div>
                <span className="font-bold">{report.consistency_percentage}%</span>
              </div>
              <Progress value={report.consistency_percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Reason */}
      {report.main_reason && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-5 w-5 ${trend.color} mt-0.5`} />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Main Reason</p>
                <p className="text-foreground">{report.main_reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {report.action_items && report.action_items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Action Items for Next Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.action_items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-medium">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Comparison */}
      {report.compared_to_high_performers && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Compared to High Performers
                </p>
                <p className="text-sm text-foreground">{report.compared_to_high_performers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
