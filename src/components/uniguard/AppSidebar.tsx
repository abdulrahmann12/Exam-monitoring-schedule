import { BarChart3, BookOpen, CalendarRange, Clock3, DoorOpen, History, LayoutDashboard, ListOrdered, Mail, Settings, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { usePermissions } from "@/hooks/usePermissions";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Scheduler", url: "/scheduler", icon: Sparkles, needsEdit: true },
  { title: "Timeline", url: "/timeline", icon: CalendarRange },
  { title: "People", url: "/people", icon: Users },
  { title: "Rooms", url: "/rooms", icon: DoorOpen },
  { title: "Time Slots", url: "/time-slots", icon: Clock3 },
  { title: "Assignments", url: "/assignments", icon: ListOrdered },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Emails", url: "/emails", icon: Mail, needsEmails: true },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "User Guide", url: "/user-guide", icon: BookOpen },
];

const adminItems = [
  { title: "Users", url: "/users", icon: UserCog },
  { title: "Activity", url: "/activity", icon: History },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  // The phone/tablet drawer always shows labels, even if the desktop sidebar is collapsed.
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const { appName, appTagline, logoDataUrl } = useBranding();
  const { canEdit, canManageUsers, canViewEmails } = usePermissions();
  const visibleItems = [
    ...items.filter((item) => (canEdit || !item.needsEdit) && (canViewEmails || !item.needsEmails)),
    ...(canManageUsers ? adminItems : []),
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground shadow-elevated overflow-hidden shrink-0">
            {logoDataUrl ? <img src={logoDataUrl} alt={appName} className="h-full w-full object-contain" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-display text-base font-bold truncate">{appName}</span>
              <span className="text-[11px] text-muted-foreground truncate">{appTagline}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const active = location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        onClick={() => { if (isMobile) setOpenMobile(false); }}
                        className={cn(
                          "transition-smooth",
                          active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
