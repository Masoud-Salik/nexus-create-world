import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, CalendarDays, CalendarRange, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";

export type PlanDuration = "daily" | "weekly" | "monthly";

interface PlanDurationSelectorProps {
  onGenerate: (duration: PlanDuration) => void;
  isLoading: boolean;
  hasExistingPlan: boolean;
}

const durationOptions = [
  {
    value: "daily" as PlanDuration,
    icon: Calendar,
    label: "Today Only",
    description: "Quick focus for today",
    days: 1,
    color: "from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-500",
  },
  {
    value: "weekly" as PlanDuration,
    icon: CalendarDays,
    label: "This Week",
    description: "Balanced 7-day plan",
    days: 7,
    color: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
    recommended: true,
  },
  {
    value: "monthly" as PlanDuration,
    icon: CalendarRange,
    label: "This Month",
    description: "Long-term 30-day strategy",
    days: 30,
    color: "from-violet-500/20 to-violet-500/5",
    iconColor: "text-violet-500",
  },
];

export function PlanDurationSelector({
  onGenerate,
  isLoading,
  hasExistingPlan,
}: PlanDurationSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (duration: PlanDuration) => {
    setOpen(false);
    onGenerate(duration);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          disabled={isLoading} 
          size="lg"
          className={`
            w-full gap-3 h-14 text-base font-semibold rounded-xl
            bg-gradient-to-r from-primary to-primary/90
            hover:from-primary/90 hover:to-primary
            shadow-lg shadow-primary/25 hover:shadow-primary/40
            transition-all duration-200
          `}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          {isLoading 
            ? "Generating..." 
            : hasExistingPlan 
              ? "Regenerate Study Plan" 
              : "✨ Generate AI Study Plan"
          }
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Choose Your Plan</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            How far ahead do you want to plan?
          </p>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {durationOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className={`
                relative h-auto p-4 justify-start gap-4 rounded-xl border-2
                hover:border-primary/50 hover:bg-gradient-to-r ${option.color}
                transition-all duration-200
                ${option.recommended ? 'border-primary/30 bg-gradient-to-r ' + option.color : ''}
              `}
              onClick={() => handleSelect(option.value)}
              disabled={isLoading}
            >
              {option.recommended && (
                <span className="absolute -top-2 right-4 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${option.color}`}>
                <option.icon className={`h-6 w-6 ${option.iconColor}`} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-base">{option.label}</div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
