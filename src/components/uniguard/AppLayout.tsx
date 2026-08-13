import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LogOut, Moon, Search, Settings as SettingsIcon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScheduleGroupSelector } from "@/components/uniguard/ScheduleGroupSelector";
import { useAuth } from "@/state/auth";

export function AppLayout({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const { theme, toggleTheme } = useBranding();
  const { user, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-soft">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b border-border bg-card/60 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="hidden md:flex items-center gap-2 max-w-sm flex-1">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search page data..." className="pl-9 h-9 bg-background/50" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ScheduleGroupSelector />
              <button onClick={() => void toggleTheme()} aria-label="Toggle theme" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted transition-smooth">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/settings" aria-label="Settings" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted transition-smooth">
                <SettingsIcon className="h-4 w-4" />
              </Link>
              <div className="hidden min-w-[140px] text-right text-xs text-muted-foreground md:block">
                <div className="font-medium text-foreground">{user?.email ?? "Authenticated"}</div>
                <div>Administrator</div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" /> Log out
              </Button>
            </div>
          </header>

          <div className="px-6 py-6 border-b border-border bg-card/30">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-display text-2xl md:text-3xl font-bold">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              {actions}
            </div>
          </div>

          <main className="flex-1 p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
