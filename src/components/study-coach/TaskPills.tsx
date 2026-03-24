import { StudyTaskData } from "./TaskCard";
import { Check } from "lucide-react";

interface TaskPillsProps {
  tasks: StudyTaskData[];
  onSelect?: (taskId: string) => void;
}

export function TaskPills({ tasks, onSelect }: TaskPillsProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center uppercase tracking-wide font-medium">
        Up Next
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {tasks.slice(0, 5).map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect?.(task.id)}
            className="flex items-center gap-2 px-3.5 py-2 bg-muted/60 hover:bg-muted rounded-full text-sm transition-colors tap-effect"
          >
            <div 
              className="w-2.5 h-2.5 rounded-full shrink-0" 
              style={{ backgroundColor: task.color }} 
            />
            {task.status === 'completed' ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : null}
            <span className="text-muted-foreground truncate max-w-[100px]">
              {task.topic.length > 18 ? `${task.topic.slice(0, 18)}...` : task.topic}
            </span>
          </button>
        ))}
        {tasks.length > 5 && (
          <div className="px-3 py-2 bg-muted/40 rounded-full text-xs text-muted-foreground">
            +{tasks.length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}
