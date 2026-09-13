import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  icon: Icon,
  label,
  onClick,
  trailing,
  destructive,
  className,
  disabled,
}: {
  icon?: React.ComponentType<{ className?: string }> | null;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const rowContent = (
    <>
      {Icon && (
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", destructive ? "bg-destructive/10" : "bg-muted")}>
          <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-muted-foreground")} />
        </div>
      )}
      <span className={cn("flex-1 text-left text-sm font-medium", destructive ? "text-destructive" : "text-foreground")}>
        {label}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null)}
    </>
  );

  if (!onClick) {
    return (
      <div className={cn("flex w-full items-center gap-3 px-4 py-3.5", className)}>
        {rowContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {rowContent}
    </button>
  );
}
