import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Check, Clock, BookOpen, Calculator, Pen, Globe, FlaskConical, Music } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  calculator: Calculator,
  pen: Pen,
  globe: Globe,
  flask: FlaskConical,
  music: Music,
};

export interface StudyTask {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  topic: string;
  duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  status: "pending" | "in_progress" | "completed" | "skipped";
}

interface TaskBreakdownProps {
  tasks: StudyTask[];
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

const difficultyColors = {
  easy: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  hard: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function TaskBreakdown({ tasks, onStart, onComplete }: TaskBreakdownProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Tasks</h3>
      
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No tasks for today. Generate a plan to get started.
          </CardContent>
        </Card>
      ) : (
        tasks.map((task) => {
          const IconComponent = iconMap[task.icon_name] || BookOpen;
          const isCompleted = task.status === "completed";
          const isInProgress = task.status === "in_progress";

          return (
            <Card
              key={task.id}
              className={`transition-all ${isCompleted ? "opacity-60" : ""} ${isInProgress ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${task.color}20` }}
                  >
                    <IconComponent className="h-5 w-5" style={{ color: task.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{task.subject_name}</span>
                      <Badge variant="outline" className={difficultyColors[task.difficulty]}>
                        {task.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{task.topic}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{task.duration_minutes} min</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!isCompleted && (
                      <>
                        <Button
                          size="sm"
                          variant={isInProgress ? "default" : "outline"}
                          onClick={() => onStart(task.id)}
                          disabled={isInProgress}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {isInProgress ? "Active" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onComplete(task.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isCompleted && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <Check className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
