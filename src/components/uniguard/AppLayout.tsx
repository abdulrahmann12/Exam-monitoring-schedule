import type { ReactNode } from "react";
import { confirmDiscardUnsaved } from "@/lib/unsavedChanges";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ChevronDown, LogOut, Moon, Settings as SettingsIcon, ShieldCheck, Sun } from "lucide-react";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          {/* One clean bar: menu + exam period on the left; theme + profile menu on the right.
              Phones: the exam period moves to its own full-width second row. */}
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur sm:px-4 md:h-16 md:flex-nowrap md:gap-x-3 md:py-0">
            <SidebarTrigger className="h-9 w-9 shrink-0" />
            <div className="hidden h-6 w-px shrink-0 bg-border md:block" aria-hidden="true" />
            <ScheduleGroupSelector className="order-last w-full md:order-none md:w-auto" />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <button onClick={() => void toggleTheme()} aria-label="Toggle theme" title={theme === "dark" ? "Light mode" : "Dark mode"} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <UserMenu
                name={user?.displayName || user?.email || "Account"}
                email={user?.email}
                detail={`${roleLabel(role)}${role === "VIEWER" ? " · read-only" : ""}`}
                university={user?.universityName}
                onLogout={() => { if (confirmDiscardUnsaved()) void logout(); }}
              />
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

/** Profile button (initials; name and role on wide screens) with account links and log out. */
function UserMenu({ name, email, detail, university, onLogout }: {
  name: string;
  email?: string;
  detail: string;
  university?: string | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  const go = (path: string) => { if (confirmDiscardUnsaved()) navigate(path); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Account menu for ${name}`} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1 transition-smooth hover:bg-muted lg:pr-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-hero text-xs font-semibold text-primary-foreground">{initials}</span>
          <span className="hidden min-w-0 max-w-[180px] text-left leading-tight lg:block">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          {email && email !== name && <div className="truncate text-xs text-muted-foreground">{email}</div>}
          <div className="mt-1 truncate text-xs text-muted-foreground">{detail}{university ? ` · ${university}` : ""}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/settings")}><SettingsIcon className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/settings?section=account")}><ShieldCheck className="mr-2 h-4 w-4" /> My account &amp; security</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
