import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DocumentSignature, Settings } from "@/api";
import { settingsService } from "@/services";
import { resolveRole } from "@/hooks/usePermissions";
import { useAuth } from "@/state/auth";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

export type Theme = "light" | "dark";

interface Branding {
  appName: string;
  appTagline: string;
  logoDataUrl: string | null;
  university: string;
  department: string;
  examPeriod: string;
  /** Signature blocks at the foot of exported schedules (may be empty). */
  documentSignatures: DocumentSignature[];
}

interface BrandingCtx extends Branding {
  theme: Theme;
  isLoading: boolean;
  /** Light / dark is each person's own choice, kept in this browser (never changes it for others). */
  toggleTheme: () => Promise<void>;
}

const DEFAULT_BRANDING: Branding = {
  appName: "Uni-Guard Schedules",
  appTagline: "Exam Invigilation Planning",
  logoDataUrl: null,
  university: "University of Example",
  department: "Faculty of Sciences",
  examPeriod: "Spring Semester 2026",
  documentSignatures: [],
};

const THEME_KEY = "invigicore.theme.v1";

const Ctx = createContext<BrandingCtx | null>(null);

function applySettingsToBranding(settings: Settings): Branding {
  return {
    appName: settings.systemName,
    appTagline: settings.appTagline || DEFAULT_BRANDING.appTagline,
    logoDataUrl: settings.logoUrl,
    university: settings.universityName,
    department: settings.department || DEFAULT_BRANDING.department,
    examPeriod: settings.examPeriod,
    documentSignatures: settings.documentSignatures ?? [],
  };
}

function initialTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY) as Theme | null;
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // localStorage unavailable (private mode / blocked) — follow the device setting
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  // The platform owner has no university, hence no university settings to load.
  const hasUniversity = isAuthenticated && resolveRole(user) !== "SUPER_ADMIN";
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const settingsQuery = useQuery({
    queryKey: ["settings", "detail"],
    queryFn: async () => unwrapServiceResponse(await settingsService.getSettings()),
    enabled: hasUniversity,
    refetchOnWindowFocus: true,
  });

  const branding = useMemo<Branding>(
    () => (isAuthenticated && settingsQuery.data ? applySettingsToBranding(settingsQuery.data) : DEFAULT_BRANDING),
    [isAuthenticated, settingsQuery.data],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable — theme just won't persist */ }
  }, [theme]);

  useEffect(() => {
    document.title = `${branding.appName} · ${branding.appTagline}`;
  }, [branding]);

  const value = useMemo<BrandingCtx>(() => ({
    ...branding,
    theme,
    isLoading: settingsQuery.isLoading,
    toggleTheme: async () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  }), [branding, settingsQuery.isLoading, theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBranding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
