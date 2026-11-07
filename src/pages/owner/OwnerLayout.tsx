import { Activity, Building2, LayoutDashboard, LogOut, Moon, ShieldCheck, Sun, UserCog } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useOwnerOverviewQuery } from "@/hooks";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { universityIssues } from "@/lib/owner/insights";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth";

const NAV = [
  { to: "/owner", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/owner/universities", label: "Universities", icon: Building2, end: false },
  { to: "/owner/activity", label: "Activity", icon: Activity, end: false },
  { to: "/owner/account", label: "Account & security", icon: UserCog, end: false },
] as const;

export default function OwnerLayout() {
  const { user, logout } = useAuth();
  const { appName, theme, toggleTheme } = useBranding();
  const overview = useOwnerOverviewQuery().data;
  const attention = overview ? overview.universities.filter((university) => universityIssues(university).length > 0).length : 0;
  const counts: Partial<Record<string, number>> = { "/owner/universities": overview?.universities.length };

  const email = user?.email ?? "";
  const avatar = (user?.displayName || email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-soft lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold">{appName}</div>
            <div className="text-xs text-muted-foreground">Owner portal</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Owner sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.to === "/owner" && attention > 0 ? (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", isActive ? "bg-primary-foreground/20" : "bg-warning/15 text-warning")} title="Need attention">
                      {attention}
                    </span>
                  ) : counts[item.to] !== undefined ? (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
                      {counts[item.to]}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{avatar}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.displayName || "Platform owner"}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile / tablet) */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{appName}</div>
              <div className="truncate text-xs text-muted-foreground">Owner portal</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Owner sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
