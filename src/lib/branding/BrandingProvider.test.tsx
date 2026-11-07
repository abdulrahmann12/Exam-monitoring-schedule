import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrandingProvider, useBranding } from "./BrandingProvider";

const updateSettings = vi.fn();

vi.mock("@/services", () => ({
  settingsService: {
    getSettings: async () => ({ success: true, error: null, data: {
      systemName: "Uni-Guard", appTagline: "Exams", logoUrl: null, theme: "LIGHT", universityName: "Cairo University",
      department: "Engineering", examPeriod: "Fall", documentSignatures: [{ title: "Head of Schedules Committee", name: "Dr. Laila" }],
    } }),
    updateSettings: (...args: unknown[]) => updateSettings(...args),
  },
}));
vi.mock("@/state/auth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { role: "ADMIN", roles: ["ROLE_ADMIN"] } }) }));

describe("branding", () => {
  it("keeps light/dark as this person's own choice and offers the export signatures", async () => {
    let branding: ReturnType<typeof useBranding> | null = null;
    function Probe() {
      branding = useBranding();
      return null;
    }
    render(<QueryClientProvider client={new QueryClient()}><BrandingProvider><Probe /></BrandingProvider></QueryClientProvider>);
    await waitFor(() => expect(branding?.documentSignatures).toEqual([{ title: "Head of Schedules Committee", name: "Dr. Laila" }]));

    const before = branding!.theme;
    await act(async () => { await branding!.toggleTheme(); });
    expect(branding!.theme).not.toBe(before);
    expect(document.documentElement.classList.contains("dark")).toBe(branding!.theme === "dark");
    expect(updateSettings).not.toHaveBeenCalled(); // never changes it for the whole university
  });
});
