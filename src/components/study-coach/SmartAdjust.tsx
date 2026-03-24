import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCw, Clock, Battery, Zap } from "lucide-react";

interface SmartAdjustProps {
  onAdjust: (mode: "less_time" | "tired" | "push_harder") => void;
  isLoading: boolean;
}

const adjustOptions = [
  {
    mode: "less_time" as const,
    icon: Clock,
    title: "I have less time",
    description: "Reduce session lengths and prioritize essentials",
  },
  {
    mode: "tired" as const,
    icon: Battery,
    title: "I'm tired",
    description: "Lower difficulty and add more breaks",
  },
  {
    mode: "push_harder" as const,
    icon: Zap,
    title: "I want to push harder",
    description: "Increase challenge and extend sessions",
  },
];

export function SmartAdjust({ onAdjust, isLoading }: SmartAdjustProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (mode: "less_time" | "tired" | "push_harder") => {
    onAdjust(mode);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Adjust Today's Plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How should I adjust your plan?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {adjustOptions.map((option) => (
            <button
              key={option.mode}
              onClick={() => handleSelect(option.mode)}
              className="w-full flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <option.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
