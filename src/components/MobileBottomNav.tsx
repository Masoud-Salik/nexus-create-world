import { NavLink } from "react-router-dom";
import { Target, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
  { title: "Focus Hub", url: "/", icon: Target },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  const handleTap = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-[68px] px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            onClick={handleTap}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 min-w-[72px] min-h-[56px] tap-effect relative",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground active:text-foreground active:bg-muted/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active pill indicator */}
                {isActive && (
                  <span className="absolute inset-1 rounded-2xl bg-primary/90 -z-10 animate-scale-in" />
                )}
                <item.icon className={cn(
                  "h-6 w-6 transition-all duration-200",
                  isActive && "scale-105 drop-shadow-sm"
                )} />
                <span className={cn(
                  "text-[10px] font-semibold tracking-wide",
                  isActive && "text-primary-foreground"
                )}>{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
