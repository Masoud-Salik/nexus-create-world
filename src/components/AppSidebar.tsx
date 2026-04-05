import { MessageSquare, GraduationCap, Settings, Info } from "lucide-react";
import { NavLink } from "react-router-dom";
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
{ title: "Settings", url: "/settings", icon: Settings },
{ title: "About", url: "/about", icon: Info }];


export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="shadow-none">
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
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