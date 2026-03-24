import { Button } from "@/components/ui/button";
import { Sparkles, Target, Brain, TrendingUp, Lightbulb, Heart } from "lucide-react";

interface QuickActionChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const quickActions = [
  { icon: Target, label: "Set a goal", prompt: "Help me set a new goal for self-improvement" },
  { icon: Brain, label: "Analyze my habits", prompt: "Analyze my recent activities and habits. What patterns do you see?" },
  { icon: TrendingUp, label: "Track progress", prompt: "How am I progressing towards my goals? Give me insights." },
  { icon: Lightbulb, label: "Daily advice", prompt: "Give me personalized advice for today based on my profile" },
  { icon: Heart, label: "Wellness check", prompt: "Let's do a quick mental wellness check-in" },
  { icon: Sparkles, label: "Motivate me", prompt: "I need some motivation. Inspire me based on my goals!" },
];

export function QuickActionChips({ onSelect, disabled }: QuickActionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center py-4 animate-fade-in">
      {quickActions.map((action, index) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(action.prompt)}
          disabled={disabled}
          className="gap-2 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 hover:scale-105 animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <action.icon className="h-3.5 w-3.5 text-primary" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
