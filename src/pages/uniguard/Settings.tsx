import { LoaderCircle, Moon, Save, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SettingsRequest, ThemeMode } from "@/api";
import { ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { useSettingsQuery, useUpdateSettingsMutation } from "@/hooks";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { toast } from "sonner";

const DEFAULT_SETTINGS_FORM: SettingsRequest = {
  systemName: "",
  appTagline: "",
  logoUrl: null,
  theme: "LIGHT",
  universityName: "",
  department: "",
  examPeriod: "",
};

export default function Settings() {
  const settingsQuery = useSettingsQuery();
  const updateMutation = useUpdateSettingsMutation();
  const { activeGroup } = useScheduleGroup();
  const [formState, setFormState] = useState<SettingsRequest>(DEFAULT_SETTINGS_FORM);

  const savePayload = useMemo<SettingsRequest>(
    () => ({
      systemName: formState.systemName.trim(),
      appTagline: formState.appTagline?.trim() || undefined,
      logoUrl: formState.logoUrl?.trim() || null,
      theme: formState.theme,
      universityName: formState.universityName.trim(),
      department: formState.department?.trim() || null,
      examPeriod: settingsQuery.data?.examPeriod?.trim() || formState.examPeriod.trim(),
    }),
    [formState, settingsQuery.data?.examPeriod],
  );

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setFormState({
      systemName: settingsQuery.data.systemName,
      appTagline: settingsQuery.data.appTagline ?? "",
      logoUrl: settingsQuery.data.logoUrl,
      theme: settingsQuery.data.theme,
      universityName: settingsQuery.data.universityName,
      department: settingsQuery.data.department ?? "",
      examPeriod: settingsQuery.data.examPeriod,
    });
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading) {
    return (
      <AppLayout title="Settings" subtitle="Customize your branding, theme, and exported document headers.">
        <LoadingState title="Loading settings..." description="Fetching backend branding and appearance settings." />
      </AppLayout>
    );
  }

  if (settingsQuery.isError) {
    return (
      <AppLayout title="Settings" subtitle="Customize your branding, theme, and exported document headers.">
        <ErrorState description={getErrorMessage(settingsQuery.error)} onRetry={() => void settingsQuery.refetch()} />
      </AppLayout>
    );
  }

  const saveState = updateMutation.getRequestState(savePayload);
  const isSaveLocked = updateMutation.getIsLocked(savePayload);

  async function handleSave() {
    try {
      await updateMutation.mutateAsync(savePayload);
      toast.success("Settings updated.");
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <AppLayout title="Settings" subtitle="Customize your branding, theme, and exported document headers.">
      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
          <header>
            <h3 className="text-display text-lg font-semibold">Brand identity</h3>
            <p className="text-sm text-muted-foreground">These settings appear in the sidebar, navbar, and exported documents.</p>
          </header>

          <div>
            <Label>System name</Label>
            <Input value={formState.systemName} onChange={(event) => setFormState((previous) => ({ ...previous, systemName: event.target.value }))} />
          </div>

          <div>
            <Label>Tagline</Label>
            <Input value={formState.appTagline ?? ""} onChange={(event) => setFormState((previous) => ({ ...previous, appTagline: event.target.value }))} />
          </div>

          <div>
            <Label>Logo URL</Label>
            <Input value={formState.logoUrl ?? ""} onChange={(event) => setFormState((previous) => ({ ...previous, logoUrl: event.target.value || null }))} placeholder="https://example.com/logo.png" />
          </div>
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
          <header>
            <h3 className="text-display text-lg font-semibold">Appearance</h3>
            <p className="text-sm text-muted-foreground">Choose the theme stored on the backend for the application shell.</p>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <ThemeCard current={formState.theme} value="LIGHT" title="Light" description="Bright workspace for daytime operations." icon={Sun} onSelect={(nextTheme) => setFormState((previous) => ({ ...previous, theme: nextTheme }))} />
            <ThemeCard current={formState.theme} value="DARK" title="Dark" description="Low-light mode for long scheduling sessions." icon={Moon} onSelect={(nextTheme) => setFormState((previous) => ({ ...previous, theme: nextTheme }))} />
          </div>
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <header>
            <h3 className="text-display text-lg font-semibold">Exported document header</h3>
            <p className="text-sm text-muted-foreground">Used as the header of every PDF and Excel export.</p>
          </header>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label>University</Label>
              <Input value={formState.universityName} onChange={(event) => setFormState((previous) => ({ ...previous, universityName: event.target.value }))} />
            </div>
            <div>
              <Label>Department / Faculty</Label>
              <Input value={formState.department ?? ""} onChange={(event) => setFormState((previous) => ({ ...previous, department: event.target.value }))} />
            </div>
            <div>
              <Label>Exam period</Label>
              <Input value={activeGroup?.name ?? formState.examPeriod} readOnly className="bg-muted/40" />
              <p className="mt-1 text-xs text-muted-foreground">
                Follows the period selected in the header. Create or switch groups there.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
            <div className="text-xs opacity-90">{formState.universityName || "University"}</div>
            <div className="mt-1 text-2xl font-bold">{formState.systemName || "System name"}</div>
            <div className="text-sm opacity-90">{formState.appTagline || "Tagline"}</div>
            <div className="mt-4 text-xs opacity-90">{formState.department || "Department"} · {activeGroup?.name || formState.examPeriod || "Exam period"}</div>
          </div>

          <Button className="gap-2" disabled={isSaveLocked || !formState.systemName.trim() || !formState.universityName.trim() || !(activeGroup?.name || formState.examPeriod).trim()} onClick={() => void handleSave()}>
            {saveState === "pending" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveState === "pending" ? "Saving..." : saveState === "cooldown" ? "Saved" : "Save settings"}
          </Button>
        </section>
      </div>
    </AppLayout>
  );
}

function ThemeCard({
  current,
  value,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  current: ThemeMode;
  value: ThemeMode;
  title: string;
  description: string;
  icon: typeof Sun;
  onSelect: (theme: ThemeMode) => void;
}) {
  return (
    <button onClick={() => onSelect(value)} className={`rounded-lg border p-4 text-left transition-smooth ${current === value ? "border-primary bg-primary/5" : "border-border"}`}>
      <Icon className="mb-2 h-5 w-5" />
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground">{description}</div>
    </button>
  );
}