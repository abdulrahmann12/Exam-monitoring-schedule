import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Settings } from "@/api";
import { settingsService } from "@/services";
import { resolveRole } from "@/hooks/usePermissions";
import { useAuth } from "@/state/auth";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

export type Theme = "light" | "dark";

interface Branding {
  appName: string;
  appTagline: string;
  logoDataUrl: string | null;
  university: string;
  department: string;
  examPeriod: string;
}

interface BrandingCtx extends Branding {
  theme: Theme;
  isLoading: boolean;
  toggleTheme: () => Promise<void>;
}

const DEFAULT_BRANDING: Branding = {
  appName: "Uni-Guard Schedules",
  appTagline: "Exam Invigilation Planning",
  logoDataUrl: null,
  university: "University of Example",
  department: "Faculty of Sciences",
  examPeriod: "Spring Semester 2026",
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
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  // The platform owner has no university, hence no university settings to load.
  const hasUniversity = isAuthenticated && resolveRole(user) !== "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY) as Theme | null;
      if (raw === "dark" || raw === "light") return raw;
    } catch {
      // localStorage unavailable (private mode / blocked) — fall back to the default theme
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", "detail"],
    queryFn: async () => unwrapServiceResponse(await settingsService.getSettings()),
    enabled: hasUniversity,
    refetchOnWindowFocus: true,
  });

  const updateThemeMutation = useMutation({
    mutationFn: async (nextTheme: Theme) => {
      if (!settingsQuery.data) {
        throw new Error("Settings are not available yet.");
      }

      return unwrapServiceResponse(
        await settingsService.updateSettings({
          systemName: settingsQuery.data.systemName,
          appTagline: settingsQuery.data.appTagline || undefined,
          logoUrl: settingsQuery.data.logoUrl,
          theme: nextTheme === "dark" ? "DARK" : "LIGHT",
          universityName: settingsQuery.data.universityName,
          department: settingsQuery.data.department,
          examPeriod: settingsQuery.data.examPeriod,
        }),
      );
    },
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(["settings", "detail"], updatedSettings);
      setBranding(applySettingsToBranding(updatedSettings));
      setThemeState(updatedSettings.theme === "DARK" ? "dark" : "light");
    },
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable — theme just won't persist */ }
  }, [theme]);

  useEffect(() => {
    document.title = `${branding.appName} · ${branding.appTagline}`;
  }, [branding]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBranding(DEFAULT_BRANDING);
      return;
    }

    if (!settingsQuery.data) {
      return;
    }

    setBranding(applySettingsToBranding(settingsQuery.data));
    setThemeState(settingsQuery.data.theme === "DARK" ? "dark" : "light");
  }, [isAuthenticated, settingsQuery.data]);

  const value = useMemo<BrandingCtx>(() => ({
    ...branding,
    theme,
    isLoading: settingsQuery.isLoading || updateThemeMutation.isPending,
    toggleTheme: async () => {
      const nextTheme = theme === "dark" ? "light" : "dark";

      if (!isAuthenticated || !settingsQuery.data) {
        setThemeState(nextTheme);
        return;
      }

      await updateThemeMutation.mutateAsync(nextTheme);
    },
  }), [branding, isAuthenticated, settingsQuery.data, settingsQuery.isLoading, theme, updateThemeMutation.isPending, updateThemeMutation.mutateAsync]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBranding() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBranding must be used inside BrandingProvider");
  return c;
}