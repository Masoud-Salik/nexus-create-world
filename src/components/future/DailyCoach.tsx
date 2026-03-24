import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Target, AlertTriangle, Zap } from "lucide-react";
import type { DailyCoachMessage } from "@/pages/TheFuture";

interface DailyCoachProps {
  data: DailyCoachMessage | null;
  onRefresh: () => void;
  loading: boolean;
}

export function DailyCoach({ data, onRefresh, loading }: DailyCoachProps) {
  const motivationColors = {
    low: "from-red-500/10 to-orange-500/10 border-red-500/20",
    medium: "from-yellow-500/10 to-amber-500/10 border-yellow-500/20",
    high: "from-green-500/10 to-emerald-500/10 border-green-500/20",
  };

  const motivationIcons = {
    low: <AlertTriangle className="h-5 w-5 text-red-500" />,
    medium: <Target className="h-5 w-5 text-yellow-600" />,
    high: <Zap className="h-5 w-5 text-green-500" />,
  };

  return (
    <Card className={`bg-gradient-to-br ${data ? motivationColors[data.motivation_level] : "from-muted/50 to-muted/30"} border overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-background/80 shrink-0">
              {data ? motivationIcons[data.motivation_level] : <Target className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Today's Priority
              </p>
              <p className="text-foreground font-medium leading-relaxed">
                {data?.priority_focus || "Generate your daily focus to get started"}
              </p>
              {data?.warning_message && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{data.warning_message}</p>
                </div>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
