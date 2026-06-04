import { memo } from "react";
import { BarChart3, Brain, Lightbulb, ChevronRight } from "lucide-react";

interface WelcomeScreenProps {
  userName?: string;
  onSuggestion: (prompt: string) => void;
}

const suggestions = [
  {
    icon: BarChart3,
    title: "My Progress",
    subtitle: "Weekly stats & insights",
    prompt: "Show me my weekly study progress, stats, and insights. How am I doing?",
  },
  {
    icon: Brain,
    title: "Quiz Me",
    subtitle: "Test my knowledge",
    prompt: "Generate a quick quiz based on my recent study topics to test my understanding.",
  },
  {
    icon: Lightbulb,
    title: "Study Tips",
    subtitle: "Personalized advice",
    prompt: "Give me personalized study tips and advice based on my profile, habits, and goals.",
  },
];

function WelcomeScreenComponent({ userName, onSuggestion }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Greeting */}
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground animate-slide-up tracking-tight">
          Ask me!
        </h1>

        {/* 3 horizontal suggestion rows */}
        <div className="flex flex-col gap-2.5 w-full">
          {suggestions.map((s, i) => (
            <button
              key={s.title}
              onClick={() => onSuggestion(s.prompt)}
              className="group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-left tap-effect animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="shrink-0 p-2 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight truncate">{s.subtitle}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const WelcomeScreen = memo(WelcomeScreenComponent);
