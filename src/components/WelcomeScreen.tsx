import { memo } from "react";
import { ClipboardList, BarChart3, Brain, Lightbulb } from "lucide-react";

interface WelcomeScreenProps {
  userName?: string;
  onSuggestion: (prompt: string) => void;
}

const suggestions = [
  {
    icon: ClipboardList,
    title: "Next Task",
    subtitle: "What should I study now?",
    prompt: "What's my next study task? Show me what I should focus on right now based on my study plan.",
  },
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
  const greeting = userName
    ? `Hey ${userName}, what can I help you study today?`
    : "What can I help you study today?";

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Greeting */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground animate-slide-up">
          {greeting}
        </h1>

        {/* 2x2 Suggestion Grid */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.title}
              onClick={() => onSuggestion(s.prompt)}
              className="group flex flex-col items-start gap-2 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-left tap-effect animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const WelcomeScreen = memo(WelcomeScreenComponent);
