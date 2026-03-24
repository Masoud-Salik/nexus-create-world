import { NavLink } from "react-router-dom";
import { Target, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
  { title: "Focus Hub", url: "/", icon: Target },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-[68px] px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all min-w-[72px] min-h-[56px] tap-effect",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground active:text-foreground active:bg-muted/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-7 w-7 transition-transform", isActive && "scale-110")} />
                <span className="text-[11px] font-medium">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
