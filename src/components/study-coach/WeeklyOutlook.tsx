import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SubjectBalance {
  name: string;
  color: string;
  targetMinutes: number;
  completedMinutes: number;
}

interface WeeklyOutlookProps {
  subjectBalances: SubjectBalance[];
  warnings: string[];
}

export function WeeklyOutlook({ subjectBalances, warnings }: WeeklyOutlookProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-medium text-foreground">Weekly Outlook</h3>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Subject Balance */}
            <div className="space-y-3">
              {subjectBalances.map((subject) => {
                const progress = Math.min(
                  100,
                  Math.round((subject.completedMinutes / subject.targetMinutes) * 100)
                );
                return (
                  <div key={subject.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="text-sm text-foreground">{subject.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {subject.completedMinutes}/{subject.targetMinutes} min
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })}
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                {warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{warning}</p>
                  </div>
                ))}
              </div>
            )}

            {subjectBalances.length === 0 && warnings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No data yet. Complete some sessions this week.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
