import { LoaderCircle, UserCog, Users } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { Person, PersonRequest, PersonRole, WeekDay } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsQuery } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

import { DayBadges } from "./DayBadges";
import { UnavailabilityPanel } from "./UnavailabilityPanel";

const WORK_WEEK: WeekDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu"];
const ALL_DAYS: WeekDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(role: PersonRole): PersonRequest {
  return { name: "", department: "", email: "", role, availableDays: WORK_WEEK, gender: null, subjectCodes: [] };
}

function parseSubjectCodes(text: string): string[] {
  return [...new Set(text.split(/[,\s;]+/).map((code) => code.trim().toUpperCase()).filter(Boolean))];
}

/** Add or edit one chief invigilator / invigilator. */
export function PersonDialog({ open, person, defaultRole = "CHIEF_INVIGILATOR", departments, isSubmitting, onOpenChange, onSubmit }: {
  open: boolean;
  /** null = add a new person */
  person: Person | null;
  defaultRole?: PersonRole;
  /** Existing departments, offered as suggestions. */
  departments: string[];
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PersonRequest) => Promise<void>;
}) {
  const ids = useId();
  const chiefRooms = useSettingsQuery().data?.chiefMaxParallelRooms ?? 2;
  const [form, setForm] = useState<PersonRequest>(() => emptyForm(defaultRole));
  const [subjectsText, setSubjectsText] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setSubjectsText((person?.subjectCodes ?? []).join(", "));
    setForm(person
      ? {
          name: person.name,
          department: person.department,
          email: person.email ?? "",
          role: person.role,
          availableDays: person.availableDays,
          gender: person.gender ?? null,
          subjectCodes: person.subjectCodes ?? [],
        }
      : emptyForm(defaultRole));
  }, [open, person, defaultRole]);

  const email = form.email?.trim() ?? "";
  const emailValid = email === "" || EMAIL_PATTERN.test(email);
  const subjectCodes = parseSubjectCodes(subjectsText);
  const nameMissing = !form.name.trim();
  const departmentMissing = !form.department.trim();
  const noDays = form.availableDays.length === 0;
  const canSave = !nameMissing && !departmentMissing && !noDays && emailValid && !isSubmitting;
  const set = (patch: Partial<PersonRequest>) => setForm((previous) => ({ ...previous, ...patch }));

  async function submit() {
    setTouched(true);
    if (!canSave) return;
    await onSubmit({
      ...form,
      name: form.name.trim().replace(/\s+/g, " "),
      department: form.department.trim().replace(/\s+/g, " "),
      email: email ? email.toLowerCase() : null,
      subjectCodes,
    });
  }

  const roles: Array<{ value: PersonRole; title: string; hint: string; icon: typeof UserCog; active: string }> = [
    { value: "CHIEF_INVIGILATOR", title: "Chief invigilator", hint: `Supervises up to ${chiefRooms} room${chiefRooms === 1 ? "" : "s"} at the same time`, icon: UserCog, active: "border-chief bg-chief-soft ring-1 ring-chief/30" },
    { value: "INVIGILATOR", title: "Invigilator", hint: "One room at a time", icon: Users, active: "border-invigilator bg-invigilator-soft ring-1 ring-invigilator/30" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{person ? `Edit ${person.name}` : "Add person"}</DialogTitle>
          <DialogDescription>{person ? "Changes apply to future scheduling right away." : "Add a chief invigilator or an invigilator to the people directory."}</DialogDescription>
        </DialogHeader>

        <form
          id={`${ids}-form`}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <fieldset>
            <legend className="sr-only">Role</legend>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Role">
              {roles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  role="radio"
                  aria-checked={form.role === role.value}
                  onClick={() => set({ role: role.value })}
                  className={cn("rounded-xl border p-3 text-left transition-colors", form.role === role.value ? role.active : "border-border hover:bg-muted/50")}
                >
                  <role.icon className={cn("mb-1.5 h-4 w-4", role.value === "CHIEF_INVIGILATOR" ? "text-chief" : "text-invigilator")} />
                  <div className="text-sm font-semibold">{role.title}</div>
                  <div className="text-[11px] text-muted-foreground">{role.hint}</div>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-name`}>Full name <span className="text-destructive">*</span></Label>
              <Input
                id={`${ids}-name`}
                value={form.name}
                maxLength={160}
                autoFocus={!person}
                placeholder={form.role === "CHIEF_INVIGILATOR" ? "Dr. Laila Fawzy" : "Ahmed Ali"}
                aria-invalid={touched && nameMissing}
                onChange={(event) => set({ name: event.target.value })}
              />
              {touched && nameMissing && <p className="text-xs text-destructive">Enter a name.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-department`}>Department <span className="text-destructive">*</span></Label>
              <Input
                id={`${ids}-department`}
                value={form.department}
                maxLength={120}
                list={`${ids}-departments`}
                placeholder="Exams Office"
                aria-invalid={touched && departmentMissing}
                onChange={(event) => set({ department: event.target.value })}
              />
              <datalist id={`${ids}-departments`}>
                {departments.map((department) => <option key={department} value={department} />)}
              </datalist>
              {touched && departmentMissing && <p className="text-xs text-destructive">Enter a department.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-email`}>Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id={`${ids}-email`}
              type="email"
              value={form.email ?? ""}
              maxLength={160}
              placeholder="name@university.edu"
              aria-invalid={!emailValid}
              onChange={(event) => set({ email: event.target.value })}
            />
            <p className={cn("text-xs", emailValid ? "text-muted-foreground" : "text-destructive")}>
              {emailValid ? "Used to email this person their schedule." : "Enter a valid email, or leave it blank."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Available days</Label>
              <div className="flex gap-1 text-xs">
                <button type="button" className="rounded-md px-2 py-0.5 text-primary hover:bg-primary/10" onClick={() => set({ availableDays: WORK_WEEK })}>Sun–Thu</button>
                <button type="button" className="rounded-md px-2 py-0.5 text-primary hover:bg-primary/10" onClick={() => set({ availableDays: ALL_DAYS })}>Every day</button>
              </div>
            </div>
            <DayBadges value={form.availableDays} onChange={(days) => set({ availableDays: days as WeekDay[] })} />
            {noDays && <p className="text-xs text-destructive">Choose at least one day.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="Gender">
                {([[null, "Not set"], ["MALE", "Male"], ["FEMALE", "Female"]] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={(form.gender ?? null) === value}
                    onClick={() => set({ gender: value })}
                    className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition-colors", (form.gender ?? null) === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Only needed for women-only or men-only halls.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-subjects`}>Subjects taught</Label>
              <Input id={`${ids}-subjects`} value={subjectsText} placeholder="MATH101, CS301" onChange={(event) => setSubjectsText(event.target.value)} />
              {subjectCodes.length > 0
                ? <div className="flex flex-wrap gap-1">{subjectCodes.map((code) => <span key={code} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{code}</span>)}</div>
                : <p className="text-xs text-muted-foreground">Never invigilates these exams (fairness).</p>}
            </div>
          </div>

          {person ? (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <UnavailabilityPanel personId={person.id} />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
              Leave dates (conference, sick leave…) can be added after saving, from Edit.
            </p>
          )}
        </form>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={`${ids}-form`} className="gap-2" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving..." : person ? "Save changes" : `Add ${form.role === "CHIEF_INVIGILATOR" ? "chief invigilator" : "invigilator"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
