import { cn } from "@/lib/utils";

interface Props {
  running: boolean;
  tint?: "primary" | "rain" | "forest" | "warm" | "night";
}

const TINTS: Record<string, [string, string, string]> = {
  primary: ["hsl(152 76% 40% / 0.18)", "hsl(180 70% 45% / 0.12)", "hsl(150 80% 55% / 0.10)"],
  rain: ["hsl(210 70% 50% / 0.16)", "hsl(195 70% 55% / 0.12)", "hsl(220 60% 45% / 0.10)"],
  forest: ["hsl(140 60% 35% / 0.18)", "hsl(120 50% 40% / 0.12)", "hsl(160 65% 30% / 0.10)"],
  warm: ["hsl(28 80% 55% / 0.16)", "hsl(12 75% 55% / 0.12)", "hsl(45 80% 60% / 0.10)"],
  night: ["hsl(240 50% 30% / 0.18)", "hsl(260 45% 35% / 0.12)", "hsl(220 60% 25% / 0.10)"],
};

export function AuroraBackground({ running, tint = "primary" }: Props) {
  const [a, b, c] = TINTS[tint] ?? TINTS.primary;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        "motion-reduce:opacity-60",
      )}
    >
      <div
        className={cn(
          "absolute -inset-[20%] blur-3xl opacity-90",
          running ? "animate-aurora-spin" : "opacity-60",
        )}
        style={{
          background: `conic-gradient(from 90deg at 50% 50%, ${a}, ${b}, ${c}, ${a})`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, hsl(var(--background) / 0) 0%, hsl(var(--background)) 70%)",
        }}
      />
    </div>
  );
}