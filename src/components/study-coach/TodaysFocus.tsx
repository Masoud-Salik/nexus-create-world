import { Card, CardContent } from "@/components/ui/card";
import { Flame, Clock, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface SubjectTime {
  name: string;
  minutes: number;
  color: string;
}

interface TodaysFocusProps {
  streak: number;
  totalMinutes: number;
  subjects: SubjectTime[];
}

export function TodaysFocus({ streak, totalMinutes, subjects }: TodaysFocusProps) {
  const today = format(new Date(), "EEEE, MMMM d");
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 
    ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` 
    : `${mins} min`;

  // Calculate progress percentage (assuming 2 hours daily goal)
  const dailyGoalMinutes = 120;
  const progressPercent = Math.min((totalMinutes / dailyGoalMinutes) * 100, 100);

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-xl shadow-primary/5">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <CardContent className="relative p-5 sm:p-6">
        {/* Header with date and streak */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wide">
              {today}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-1 flex items-center gap-2">
              <Target className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              Today's Focus
            </h2>
          </div>
          
          {streak > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-full border border-orange-500/20 animate-pulse">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-bold text-orange-500 text-sm sm:text-base">
                {streak} day{streak !== 1 ? 's' : ''} 🔥
              </span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Time</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{timeDisplay}</p>
          </div>
          
          <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">{Math.round(progressPercent)}%</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subject breakdown */}
        {subjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Subject Breakdown
            </p>
            {subjects.map((subject, index) => (
              <div
                key={subject.name}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-background/80 border border-border/50 min-h-[52px] transition-all hover:bg-background hover:border-border"
                style={{ animationDelay: `${index * 50}ms` }}
              >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background ring-current"
                  style={{ backgroundColor: subject.color, color: subject.color }}
                />
                <span className="font-medium text-foreground">{subject.name}</span>
              </div>
                <span className="text-sm font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  {subject.minutes} min
                </span>
              </div>
            ))}
          </div>
        )}

        {subjects.length === 0 && (
          <div className="text-center py-8 px-4 bg-muted/30 rounded-xl border-2 border-dashed border-muted">
            <Target className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              No subjects planned yet
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add subjects below to get started
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
