import { Flame, Clock, CheckCircle2 } from "lucide-react";

interface CompactStatsBarProps {
  streak: number;
  pendingMinutes: number;
  completedCount: number;
  totalCount: number;
}

export function CompactStatsBar({ 
  streak, 
  pendingMinutes, 
  completedCount, 
  totalCount 
}: CompactStatsBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg text-xs">
      <div className="flex items-center gap-3">
        {streak > 0 && (
          <div className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            <span className="font-bold text-orange-500">{streak}d</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{pendingMinutes}m</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        <span className="font-medium">{completedCount}/{totalCount}</span>
      </div>
    </div>
  );
}
