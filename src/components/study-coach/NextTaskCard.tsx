import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Book, Calculator, Atom, Globe, Music, Pen, Sparkles } from "lucide-react";
import { StudyTaskData } from "./TaskCard";

interface NextTaskCardProps {
  task: StudyTaskData;
  onStart: (taskId: string) => void;
  disabled?: boolean;
}

const iconMap: Record<string, any> = {
  book: Book,
  "book-open": Book,
  calculator: Calculator,
  atom: Atom,
  flask: Atom,
  globe: Globe,
  music: Music,
  pen: Pen,
};

const difficultyEmoji: Record<string, string> = {
  easy: "⚡",
  medium: "💪",
  hard: "🔥",
};

export function NextTaskCard({ task, onStart, disabled }: NextTaskCardProps) {
  const Icon = iconMap[task.icon_name] || Book;

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <div className="p-6 text-center">
        {/* Label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs uppercase tracking-widest font-semibold text-primary">
            Next Up
          </p>
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Subject Icon */}
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ 
            backgroundColor: `${task.color}20`,
            boxShadow: `0 8px 24px ${task.color}30`
          }}
        >
          <Icon className="h-8 w-8" style={{ color: task.color }} />
        </div>

        {/* Subject & Topic */}
        <h2 className="text-xl font-bold text-foreground mb-1">
          {task.subject_name}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {task.topic}
        </p>

        {/* Big Start Button */}
        <Button 
          size="lg" 
          className="w-full h-14 text-lg font-bold gap-3 shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-primary/90 hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => onStart(task.id)}
          disabled={disabled}
        >
          <Play className="h-6 w-6 fill-current" />
          Start Now
        </Button>

        {/* Duration & Difficulty */}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {task.duration_minutes} min
          </span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <span className="flex items-center gap-1">
            {difficultyEmoji[task.difficulty] || "💪"} {task.difficulty}
          </span>
        </div>
      </div>
    </Card>
  );
}
