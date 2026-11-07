import { Building2, ChevronLeft, ImageOff, KeyRound, ListChecks, LoaderCircle, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import type { DocumentSignature, Settings as SettingsData, SettingsRequest } from "@/api";
import { ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { ChangePasswordCard } from "@/components/uniguard/ChangePasswordCard";
import { ConnectedAccountsCard } from "@/components/uniguard/ConnectedAccountsCard";
import { TwoFactorCard } from "@/components/uniguard/TwoFactorCard";
import { UniversitySsoCard } from "@/components/uniguard/UniversitySsoCard";
import { useSettingsQuery, useUpdateSettingsMutation } from "@/hooks";
import { useDemoUser } from "@/hooks/useDemoUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnsavedChangesGuard } from "@/lib/unsavedChanges";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage, showErrorToast } from "@/utils/error";

type Section = "university" | "rules" | "sign-in" | "account";

const MAX_SIGNATURES = 4;
const SIGNATURE_TITLES = ["Head of Schedules Committee", "University Vice President", "Dean of the Faculty", "Head of Department", "Exams Office Manager", "Prepared by"];

/** The editable part of the settings (theme and exam period are sent back as the server has them). */
interface Form {
  systemName: string;
  appTagline: string;
  logoUrl: string;
  universityName: string;
  department: string;
  maxDutiesPerDay: number;
  maxDutiesPerPeriod: number;
  minRestMinutes: number;
  studentsPerInvigilator: number;
  chiefMaxParallelRooms: number;
  documentSignatures: DocumentSignature[];
}

function toForm(settings: SettingsData): Form {
  return {
    systemName: settings.systemName,
    appTagline: settings.appTagline ?? "",
    logoUrl: settings.logoUrl ?? "",
    universityName: settings.universityName,
    department: settings.department ?? "",
    maxDutiesPerDay: settings.maxDutiesPerDay ?? 0,
    maxDutiesPerPeriod: settings.maxDutiesPerPeriod ?? 0,
    minRestMinutes: settings.minRestMinutes ?? 0,
    studentsPerInvigilator: settings.studentsPerInvigilator ?? 0,
    chiefMaxParallelRooms: settings.chiefMaxParallelRooms ?? 2,
    documentSignatures: settings.documentSignatures ?? [],
  };
}

function toRequest(form: Form, settings: SettingsData): SettingsRequest {
  const whole = (value: number, min = 0) => Math.max(min, Math.trunc(value || 0));
  return {
    systemName: form.systemName.trim(),
    appTagline: form.appTagline.trim() || undefined,
    logoUrl: form.logoUrl.trim() || null,
    theme: settings.theme,
    universityName: form.universityName.trim(),
    department: form.department.trim() || null,
    examPeriod: settings.examPeriod,
    maxDutiesPerDay: whole(form.maxDutiesPerDay),
    maxDutiesPerPeriod: whole(form.maxDutiesPerPeriod),
    minRestMinutes: whole(form.minRestMinutes),
    studentsPerInvigilator: whole(form.studentsPerInvigilator),
    chiefMaxParallelRooms: Math.min(10, whole(form.chiefMaxParallelRooms, 1)),
    documentSignatures: form.documentSignatures
      .map((signature) => ({ title: signature.title.trim(), name: signature.name.trim() }))
      .filter((signature) => signature.title || signature.name),
  };
}

export default function Settings() {
  const settingsQuery = useSettingsQuery();
  const updateMutation = useUpdateSettingsMutation();
  const { activeGroup } = useScheduleGroup();
  const isDemo = useDemoUser();
  const { canEditSettings, canManageUsers } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (settingsQuery.data) setForm(toForm(settingsQuery.data));
  }, [settingsQuery.data]);

  const sections = useMemo(() => {
    const list: Array<{ id: Section; label: string; icon: typeof Building2; hint: string }> = [];
    if (canEditSettings) {
      list.push({ id: "university", label: "University", icon: Building2, hint: "Name, logo, document header and signatures" });
      list.push({ id: "rules", label: "Scheduling rules", icon: ListChecks, hint: "Limits the Scheduler respects" });
    }
    if (canManageUsers) list.push({ id: "sign-in", label: "Sign-in options", icon: KeyRound, hint: "Microsoft sign-in for your staff" });
    list.push({ id: "account", label: "My account", icon: UserRound, hint: "Password and two-step sign-in" });
    return list;
  }, [canEditSettings, canManageUsers]);

  const requested = searchParams.get("section") as Section | null;
  const section: Section = sections.some((item) => item.id === requested) ? (requested as Section) : sections[0].id;
  const savedForm = settingsQuery.data ? toForm(settingsQuery.data) : null;
  const dirty = Boolean(form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));
  useUnsavedChangesGuard(dirty ? "Your settings changes are not saved yet. Leave without saving?" : null);

  if (settingsQuery.isLoading || (settingsQuery.data && !form)) {
    return (
      <AppLayout title="Settings" subtitle="University settings and your own account.">
        <LoadingState title="Loading settings..." />
      </AppLayout>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data || !form) {
    return (
      <AppLayout title="Settings" subtitle="University settings and your own account.">
        <ErrorState description={getErrorMessage(settingsQuery.error)} onRetry={() => void settingsQuery.refetch()} />
      </AppLayout>
    );
  }

  const settings = settingsQuery.data;
  const set = (patch: Partial<Form>) => setForm((previous) => (previous ? { ...previous, ...patch } : previous));
  const signaturesValid = form.documentSignatures.every((signature) => signature.title.trim() !== "" || signature.name.trim() === "");
  const canSave = dirty && form.systemName.trim() !== "" && form.universityName.trim() !== "" && signaturesValid && !updateMutation.isPending;

  async function save() {
    if (!form) return;
    try {
      await updateMutation.mutateAsync(toRequest(form, settings));
      toast.success("Settings saved.");
    } catch (error) {
      showErrorToast(error, { title: "Could not save the settings." });
    }
  }

  return (
    <AppLayout
      title="Settings"
      subtitle={canEditSettings ? "University settings for everyone, and your own account." : "Your own account. University settings are managed by an administrator."}
    >
      <div className="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="grid grid-cols-2 gap-1 sm:flex sm:overflow-x-auto sm:no-scrollbar lg:flex-col" aria-label="Settings sections">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSearchParams({ section: item.id }, { replace: true })}
              aria-current={section === item.id ? "page" : undefined}
              className={cn(
                "flex min-w-0 shrink-0 items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors sm:gap-3",
                section === item.id ? "bg-card shadow-card ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("mt-0.5 h-4 w-4 shrink-0", section === item.id && "text-primary")} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="hidden text-xs text-muted-foreground lg:block">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {section === "university" && <UniversitySection form={form} set={set} examPeriod={activeGroup?.name || settings.examPeriod} />}
          {section === "rules" && <RulesSection form={form} set={set} />}
          {section === "sign-in" && <UniversitySsoCard />}
          {section === "account" && (
            isDemo ? (
              <Card title="My account" description="The demo account is shared, so its password and sign-in cannot be changed." />
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChangePasswordCard showSignOutEverywhere />
                <TwoFactorCard />
                <div className="xl:col-span-2"><ConnectedAccountsCard /></div>
              </div>
            )
          )}
        </div>
      </div>

      {dirty && canEditSettings && (
        <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center px-2">
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-elevated backdrop-blur animate-fade-in">
            <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
            <span className="flex-1 text-sm font-medium">
              Unsaved changes
              {!signaturesValid && <span className="block text-xs font-normal text-destructive">Each signature needs a title.</span>}
            </span>
            <Button variant="ghost" onClick={() => setForm(savedForm)} disabled={updateMutation.isPending}>Discard</Button>
            <Button className="gap-2" disabled={!canSave} onClick={() => void save()}>
              {updateMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── University ─────────────────────────────────────────────────────────────

function UniversitySection({ form, set, examPeriod }: { form: Form; set: (patch: Partial<Form>) => void; examPeriod: string }) {
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => setLogoBroken(false), [form.logoUrl]);
  const logo = form.logoUrl.trim();

  const updateSignature = (index: number, patch: Partial<DocumentSignature>) =>
    set({ documentSignatures: form.documentSignatures.map((signature, i) => (i === index ? { ...signature, ...patch } : signature)) });
  const moveLeft = (index: number) => {
    if (index === 0) return;
    const next = [...form.documentSignatures];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    set({ documentSignatures: next });
  };

  return (
    <>
      <Card title="Name and logo" description="Shown in the sidebar, on the sign-in page and in the browser tab.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="system-name" label="System name" required>
            <Input id="system-name" value={form.systemName} maxLength={120} onChange={(event) => set({ systemName: event.target.value })} />
          </Field>
          <Field id="tagline" label="Tagline">
            <Input id="tagline" value={form.appTagline} maxLength={160} placeholder="Exam Invigilation Planning" onChange={(event) => set({ appTagline: event.target.value })} />
          </Field>
        </div>
        <Field id="logo-url" label="Logo address" hint="A link to a PNG or SVG image (square works best). Leave empty to use the shield icon.">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
              {logo && !logoBroken
                ? <img src={logo} alt="Logo preview" className="h-full w-full object-contain" onError={() => setLogoBroken(true)} />
                : logo ? <ImageOff className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            </div>
            <Input id="logo-url" value={form.logoUrl} placeholder="https://university.edu/logo.png" onChange={(event) => set({ logoUrl: event.target.value })} />
          </div>
          {logo && logoBroken && <p className="text-xs text-destructive">This image could not be loaded. Check the address.</p>}
        </Field>
      </Card>

      <Card title="Exported documents" description="The header and footer of every PDF schedule.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="university-name" label="University" required>
            <Input id="university-name" value={form.universityName} maxLength={160} onChange={(event) => set({ universityName: event.target.value })} />
          </Field>
          <Field id="department" label="Department or faculty">
            <Input id="department" value={form.department} maxLength={160} placeholder="Faculty of Engineering" onChange={(event) => set({ department: event.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">The exam period printed in the header is the one selected at the top of the page (now: <span className="font-medium text-foreground">{examPeriod}</span>).</p>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Footer signatures</h3>
              <p className="text-xs text-muted-foreground">Up to {MAX_SIGNATURES}, printed left to right at the bottom of every page.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={form.documentSignatures.length >= MAX_SIGNATURES}
              onClick={() => set({ documentSignatures: [...form.documentSignatures, { title: "", name: "" }] })}
            >
              <Plus className="h-4 w-4" /> Add signature
            </Button>
          </div>
          <datalist id="signature-titles">{SIGNATURE_TITLES.map((title) => <option key={title} value={title} />)}</datalist>
          {form.documentSignatures.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No signatures yet. Add one, for example “Head of Schedules Committee” with the person's name.
            </p>
          ) : (
            <ol className="space-y-2">
              {form.documentSignatures.map((signature, index) => {
                const missingTitle = signature.title.trim() === "" && signature.name.trim() !== "";
                return (
                  <li key={index} className="flex items-start gap-2 rounded-lg border border-border p-2">
                    <span className="grid h-9 w-6 shrink-0 place-items-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        list="signature-titles"
                        value={signature.title}
                        maxLength={80}
                        placeholder="Title, e.g. Head of Schedules Committee"
                        aria-label={`Signature ${index + 1} title`}
                        aria-invalid={missingTitle}
                        onChange={(event) => updateSignature(index, { title: event.target.value })}
                      />
                      <Input
                        value={signature.name}
                        maxLength={120}
                        placeholder="Name, e.g. Dr. Laila Fawzy"
                        aria-label={`Signature ${index + 1} name`}
                        onChange={(event) => updateSignature(index, { name: event.target.value })}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={index === 0} aria-label={`Move signature ${index + 1} left`} onClick={() => moveLeft(index)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove signature ${index + 1}`}
                      onClick={() => set({ documentSignatures: form.documentSignatures.filter((_, i) => i !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <DocumentPreview form={form} examPeriod={examPeriod} />
      </Card>
    </>
  );
}

/** A small sketch of an exported page: header on top, signatures at the bottom. */
function DocumentPreview({ form, examPeriod }: { form: Form; examPeriod: string }) {
  const signatures = form.documentSignatures.filter((signature) => signature.title.trim() || signature.name.trim());
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview of an exported page</figcaption>
      <div className="overflow-hidden rounded-lg border border-border bg-white text-slate-900 shadow-sm" aria-label="Exported page preview">
        <div className="flex items-start justify-between gap-4 bg-slate-50 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[#1f4087]">{form.universityName || "University"}</div>
            <div className="truncate text-[11px] text-slate-500">{form.department || "Department"} · {examPeriod}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-bold">{form.systemName || "System name"} · Exam Schedule</div>
            <div className="text-[11px] text-slate-500">Tue, 2026-11-10</div>
          </div>
        </div>
        <div className="space-y-1.5 px-5 py-4" aria-hidden>
          {[0, 1, 2].map((row) => <div key={row} className="h-2 rounded bg-slate-100" style={{ width: `${92 - row * 9}%` }} />)}
        </div>
        <div className="border-t border-slate-200 px-5 py-3">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Generated by {form.systemName || "the system"} on …</span><span>Page 1</span>
          </div>
          {signatures.length > 0 && (
            <div className={cn("mt-2 grid gap-3", ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][signatures.length - 1])}>
              {signatures.map((signature, index) => (
                <div key={index} className={cn(index === 0 ? "text-left" : index === signatures.length - 1 ? "text-right" : "text-center")}>
                  <div className="truncate text-[11px] font-bold">{signature.title || "—"}</div>
                  <div className="truncate text-[11px] text-slate-500">{signature.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

// ── Scheduling rules ───────────────────────────────────────────────────────

function RulesSection({ form, set }: { form: Form; set: (patch: Partial<Form>) => void }) {
  return (
    <Card title="Scheduling rules" description="The Scheduler and the server enforce these for every exam period, when generating and when saving. 0 means no limit.">
      <div className="divide-y divide-border">
        <Rule
          id="chief-rooms" label="Rooms one chief invigilator can cover at the same time" min={1} max={10}
          value={form.chiefMaxParallelRooms} onChange={(value) => set({ chiefMaxParallelRooms: value })}
          example={`A chief can be chief of ${form.chiefMaxParallelRooms} room${form.chiefMaxParallelRooms === 1 ? "" : "s"} at overlapping times. Invigilators always cover one room at a time.`}
        />
        <Rule
          id="students-per-invigilator" label="Students per invigilator" max={1000}
          value={form.studentsPerInvigilator} onChange={(value) => set({ studentsPerInvigilator: value })}
          example={form.studentsPerInvigilator > 0
            ? `A room with 75 students needs at least ${Math.ceil(75 / form.studentsPerInvigilator)} invigilators (or the room's own minimum, if higher).`
            : "Off: every room needs its own minimum number of invigilators."}
        />
        <Rule
          id="max-per-day" label="Duty sessions per person per day" max={12}
          value={form.maxDutiesPerDay} onChange={(value) => set({ maxDutiesPerDay: value })}
          example={form.maxDutiesPerDay > 0 ? `Nobody gets more than ${form.maxDutiesPerDay} session${form.maxDutiesPerDay === 1 ? "" : "s"} on one day. Rooms covered at the same time count once.` : "Off: no daily limit."}
        />
        <Rule
          id="max-per-period" label="Duty sessions per person per exam period" max={500}
          value={form.maxDutiesPerPeriod} onChange={(value) => set({ maxDutiesPerPeriod: value })}
          example={form.maxDutiesPerPeriod > 0 ? `Nobody gets more than ${form.maxDutiesPerPeriod} sessions in one exam period.` : "Off: no limit per exam period."}
        />
        <Rule
          id="min-rest" label="Minimum break between two sessions (minutes)" max={600}
          value={form.minRestMinutes} onChange={(value) => set({ minRestMinutes: value })}
          example={form.minRestMinutes > 0 ? `After a session ending at 11:00, the same person's next session starts at ${restExample(form.minRestMinutes)} at the earliest.` : "Off: back-to-back sessions are allowed."}
        />
      </div>
    </Card>
  );
}

function restExample(minutes: number): string {
  const total = 11 * 60 + minutes;
  if (total >= 24 * 60) return "the next day";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Rule({ id, label, example, value, onChange, min = 0, max }: {
  id: string; label: string; example: string; value: number; onChange: (value: number) => void; min?: number; max: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{example}</p>
      </div>
      <Input id={id} type="number" min={min} max={max} value={value} className="tabular-nums"
        onChange={(event) => onChange(Math.min(max, Math.max(min, Math.trunc(Number(event.target.value)) || min)))} />
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────

function Card({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <header className={cn("px-6 py-4", children && "border-b border-border/70")}>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      {children && <div className="space-y-4 p-6">{children}</div>}
    </section>
  );
}

function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
