import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Check, Clock, BookOpen, Calculator, Pen, Globe, FlaskConical, Music, Zap, Atom } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  "book-open": BookOpen,
  calculator: Calculator,
  pen: Pen,
  globe: Globe,
  flask: FlaskConical,
  music: Music,
  atom: Atom,
};

export interface StudyTaskData {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  topic: string;
  duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  status: "pending" | "in_progress" | "completed" | "partial" | "skipped";
  actual_minutes?: number;
}

interface TaskCardProps {
  task: StudyTaskData;
  onStart: (taskId: string) => void;
  disabled?: boolean;
  index?: number;
}

const difficultyConfig = {
  easy: { 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    label: "Easy",
    icon: "⚡"
  },
  medium: { 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    label: "Medium",
    icon: "💪"
  },
  hard: { 
    color: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    label: "Hard",
    icon: "🔥"
  },
};

const statusConfig = {
  completed: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: Check,
    label: "Complete",
    emoji: "✓",
  },
  partial: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Clock,
    label: "Partial",
    emoji: "◐",
  },
  skipped: {
    badge: "bg-muted text-muted-foreground border-muted",
    icon: Clock,
    label: "Skipped",
    emoji: "—",
  },
  pending: {
    badge: "",
    icon: null,
    label: "",
    emoji: "",
  },
  in_progress: {
    badge: "bg-primary/10 text-primary border-primary/20",
    icon: Zap,
    label: "In Progress",
    emoji: "▶",
  },
};

export function TaskCard({ task, onStart, disabled, index = 0 }: TaskCardProps) {
  const IconComponent = iconMap[task.icon_name] || BookOpen;
  const isFinished = ["completed", "partial", "skipped"].includes(task.status);
  const statusInfo = statusConfig[task.status];
  const difficultyInfo = difficultyConfig[task.difficulty];
  const isPending = task.status === "pending";

  return (
    <Card
      className={`
        transition-all duration-300 tap-effect overflow-hidden
        ${isFinished ? "opacity-50 scale-[0.98]" : "hover:shadow-lg hover:shadow-primary/5"}
        ${task.status === "in_progress" ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""}
        ${isPending ? "hover:border-primary/30" : ""}
      `}
      style={{ 
        animationDelay: `${index * 50}ms`,
      }}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Color accent bar */}
          <div 
            className="w-1.5 shrink-0"
            style={{ backgroundColor: task.color }}
          />
          
          <div className="flex-1 p-4 flex items-center gap-4">
            {/* Subject icon with background */}
            <div
              className="p-3.5 rounded-2xl shrink-0 transition-transform duration-200"
              style={{ backgroundColor: `${task.color}15` }}
            >
              <IconComponent 
                className="h-6 w-6 transition-all" 
                style={{ color: task.color }} 
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-base">
                  {task.subject_name}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 h-5 ${difficultyInfo.color}`}
                >
                  {difficultyInfo.icon} {difficultyInfo.label}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-1">
                {task.topic}
              </p>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {task.actual_minutes !== undefined && task.actual_minutes !== task.duration_minutes
                    ? `${task.actual_minutes}/${task.duration_minutes} min`
                    : `${task.duration_minutes} min`}
                </span>
              </div>
            </div>

            {/* Action button */}
            <div className="shrink-0">
              {isFinished ? (
                <div className={`
                  flex items-center gap-1.5 py-2 px-3 rounded-full text-sm font-medium
                  ${statusInfo.badge}
                `}>
                  {statusInfo.icon && <statusInfo.icon className="h-4 w-4" />}
                  {statusInfo.label}
                </div>
              ) : (
                <Button
                  size="lg"
                  className={`
                    min-h-[52px] min-w-[100px] px-5 rounded-xl font-semibold text-base
                    bg-gradient-to-r from-primary to-primary/90
                    hover:from-primary/90 hover:to-primary
                    shadow-lg shadow-primary/25 hover:shadow-primary/40
                    transition-all duration-200
                    ${task.status === "in_progress" ? "animate-pulse" : ""}
                  `}
                  onClick={() => onStart(task.id)}
                  disabled={disabled || task.status === "in_progress"}
                >
                  <Play className="h-5 w-5 mr-2 fill-current" />
                  {task.status === "in_progress" ? "Resume" : "Start"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
