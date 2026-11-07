import type { ReactNode } from "react";
import { confirmDiscardUnsaved } from "@/lib/unsavedChanges";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LogOut, Moon, Search, Settings as SettingsIcon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScheduleGroupSelector } from "@/components/uniguard/ScheduleGroupSelector";
import { useAuth } from "@/state/auth";
import { roleLabel, usePermissions } from "@/hooks/usePermissions";

export function AppLayout({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const { theme, toggleTheme } = useBranding();
  const { user, logout } = useAuth();
  const { role } = usePermissions();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-soft">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Phones: two rows (menu + icons, then the exam period). Laptops and up: one row. */}
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur sm:px-4 md:h-16 md:flex-nowrap md:py-0">
            <SidebarTrigger className="h-9 w-9 shrink-0" />
            <div className="hidden max-w-sm flex-1 items-center gap-2 xl:flex">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search page data..." className="pl-9 h-9 bg-background/50" />
              </div>
            </div>
            <ScheduleGroupSelector className="order-last w-full md:order-none md:ml-auto md:w-auto xl:ml-0" />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-0">
              <button onClick={() => void toggleTheme()} aria-label="Toggle theme" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted transition-smooth">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/settings" aria-label="Settings" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted transition-smooth">
                <SettingsIcon className="h-4 w-4" />
              </Link>
              <div className="hidden max-w-[220px] text-right text-xs text-muted-foreground xl:block">
                <div className="truncate font-medium text-foreground">{user?.displayName || user?.email || "Authenticated"}</div>
                <div className="truncate">{roleLabel(role)}{role === "VIEWER" ? " · read-only" : ""}{user?.universityName ? ` · ${user.universityName}` : ""}</div>
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-2 px-2.5 sm:px-3" aria-label="Log out" onClick={() => { if (confirmDiscardUnsaved()) void logout(); }}>
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </header>

          <div className="border-b border-border bg-card/30 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-display text-2xl md:text-3xl font-bold break-words">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              {actions}
            </div>
          </div>

          <main className="flex-1 min-w-0 px-4 py-5 sm:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
