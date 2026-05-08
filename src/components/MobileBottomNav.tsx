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
      <div className="flex items-center justify-around h-[56px] px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            onClick={handleTap}
            aria-label={item.title}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all duration-200 min-w-[64px] min-h-[48px] tap-effect relative",
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
                  <span className="absolute inset-1 rounded-2xl bg-primary/90 -z-10 animate-spring-scale" />
                )}
                <item.icon className={cn( 
                  "h-5 w-5 transition-all duration-200",
                  isActive && "scale-105 drop-shadow-sm"
                )} />
                <span className={cn( 
                  "text-[9px] font-semibold tracking-wide",
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
