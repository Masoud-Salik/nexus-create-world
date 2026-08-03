import { MessageSquare, GraduationCap, Settings, Info, Brain, Library } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem } from
"@/components/ui/sidebar";

const items = [
{ title: "AI Chat", url: "/chat", icon: MessageSquare },
{ title: "Focus Hub", url: "/", icon: GraduationCap },
{ title: "Library", url: "/library", icon: Library },
{ title: "Settings", url: "/settings", icon: Settings },
{ title: "About", url: "/about", icon: Info }];


export function AppSidebar() {
  const isAdmin = useIsAdmin();
  const allItems = isAdmin
    ? [...items, { title: "AI Training", url: "/ai-training", icon: Brain }]
    : items;
  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="shadow-none">
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className={({ isActive }) =>
                    isActive ?
                    "bg-muted text-primary font-medium" :
                    "hover:bg-muted/50"
                    }>
                    
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>);

}