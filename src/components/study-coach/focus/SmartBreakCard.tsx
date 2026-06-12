import { useEffect, useState } from "react";
import { Eye, Droplet, Wind, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface Card { icon: any; title: string; body: string; tint: string; }

const CARDS: Card[] = [
  { icon: Eye, title: "20-20-20 eye rest", body: "Look at something 20 feet away for 20 seconds. Reset your eyes.", tint: "text-sky-400" },
  { icon: Wind, title: "Box breathing", body: "Inhale 4s · hold 4s · exhale 4s · hold 4s. Three rounds.", tint: "text-emerald-400" },
  { icon: Droplet, title: "Hydrate", body: "A glass of water now beats coffee in 30 minutes. Cognition needs H₂O.", tint: "text-cyan-400" },
  { icon: Brain, title: "Recall, don't reread", body: "Without looking, try to restate what you just learned. That's where retention lives.", tint: "text-violet-400" },
];

export function SmartBreakCard({ intent }: { intent?: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CARDS.length), 12000);
    return () => clearInterval(t);
  }, []);
  const c = CARDS[idx];
  const Icon = c.icon;
  return (
    <div
      key={idx}
      className="w-full max-w-sm mx-auto p-4 rounded-2xl border border-border bg-card/80 backdrop-blur shadow-md animate-fade-in"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("h-4 w-4", c.tint)} />
        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Smart break</span>
      </div>
      <div className="text-sm font-bold text-foreground">{c.title}</div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.body}</p>
      {intent && idx === 3 && (
        <p className="text-[11px] text-primary mt-2 italic">Quick test: what's one thing you learned about "{intent}"?</p>
      )}
      <div className="flex gap-1 mt-3 justify-center">
        {CARDS.map((_, i) => (
          <span key={i} className={cn("h-1 rounded-full transition-all", i === idx ? "w-4 bg-primary" : "w-1.5 bg-muted")} />
        ))}
      </div>
    </div>
  );
}