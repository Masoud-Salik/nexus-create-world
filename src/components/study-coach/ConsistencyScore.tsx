import { Card, CardContent } from "@/components/ui/card";

interface ConsistencyScoreProps {
  score: number;
  completedTasks: number;
  totalTasks: number;
}

export function ConsistencyScore({ score, completedTasks, totalTasks }: ConsistencyScoreProps) {
  const getColor = () => {
    if (score >= 71) return "text-green-500";
    if (score >= 41) return "text-yellow-500";
    return "text-red-500";
  };

  const getStrokeColor = () => {
    if (score >= 71) return "#22c55e";
    if (score >= 41) return "#eab308";
    return "#ef4444";
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium text-foreground mb-4">Consistency</h3>
        
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={getStrokeColor()}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${getColor()}`}>{score}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {completedTasks} of {totalTasks} tasks completed this week
            </p>
            <p className="text-xs text-muted-foreground">
              Based on planned vs completed tasks
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
