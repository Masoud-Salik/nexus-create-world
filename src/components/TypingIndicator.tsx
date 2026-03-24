import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="group relative py-6 px-4 bg-muted/50 animate-fade-in">
      <div className="mx-auto max-w-3xl flex gap-4">
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground animate-pulse">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 flex items-center">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="ml-3 text-sm text-muted-foreground animate-pulse">
            Thinking...
          </span>
        </div>
      </div>
    </div>
  );
}
