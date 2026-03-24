import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Target, Trophy, Timer } from "lucide-react";

interface WelcomeScreenProps {
  userName?: string;
  onGetStarted: () => void;
  isLoading?: boolean;
}

const FeatureCard = memo(({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
    <Icon className="h-6 w-6 text-primary mx-auto mb-1" />
    <h3 className="font-medium text-xs">{title}</h3>
    <p className="text-[10px] text-muted-foreground">{description}</p>
  </div>
));

FeatureCard.displayName = "FeatureCard";

function WelcomeScreenComponent({ userName, onGetStarted, isLoading }: WelcomeScreenProps) {
  const greeting = userName ? `Welcome back, ${userName}` : "Welcome to Study Hub Pro";
  
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-lg text-center space-y-6">
        {/* Logo */}
        <div className="relative inline-flex">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <MessageSquare className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Greeting */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your AI study companion — chat, focus, compete, and level up your learning.
          </p>
        </div>

        {/* Features Grid - Reflects current app */}
        <div className="grid grid-cols-3 gap-2">
          <FeatureCard icon={MessageSquare} title="AI Chat" description="Ask anything" />
          <FeatureCard icon={Timer} title="Focus Hub" description="Deep work timer" />
          <FeatureCard icon={Trophy} title="Leaderboard" description="Compete weekly" />
        </div>

        {/* CTA Button */}
        <Button
          onClick={onGetStarted}
          disabled={isLoading}
          size="lg"
          className="gap-2 px-6 py-5 text-base rounded-full shadow-lg"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Start Chatting
            </>
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground">
          Press Enter or click to begin
        </p>
      </div>
    </div>
  );
}

export const WelcomeScreen = memo(WelcomeScreenComponent);
