import {
  CalendarCheck, DoorOpen, MoreHorizontal, PencilLine, Plus, Power, RotateCcw, Search, ShieldCheck, Trash2, UserPlus, Users, UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DEFAULT_UNIVERSITY_ID, type AdminInvitation, type OwnerUniversity, type OwnerUniversityAdmin } from "@/api";
import { ErrorState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerOverviewQuery } from "@/hooks";
import {
  filterUniversities, relativeTime, universityIssues, type UniversityFilter, type UniversitySort,
} from "@/lib/owner/insights";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";

import {
  AddAdminDialog, CreateUniversityDialog, DeleteUniversityDialog, InvitationDialog, RenameDialog, ResetTwoFactorDialog, ToggleDialog,
} from "./OwnerDialogs";
import { AdminStatusBadge, IssueChips, PageHeader, StatusBadge, UniversityAvatar } from "./OwnerUi";

type DialogState =
  | { kind: "create" }
  | { kind: "rename"; university: OwnerUniversity }
  | { kind: "toggle"; university: OwnerUniversity }
  | { kind: "delete"; university: OwnerUniversity }
  | { kind: "add-admin"; university: OwnerUniversity; email?: string }
  | { kind: "reset-2fa"; university: OwnerUniversity; admin: OwnerUniversityAdmin }
  | { kind: "invitation"; result: AdminInvitation }
  | null;

const SORT_LABELS: Record<UniversitySort, string> = {
  name: "Name (A–Z)",
  recent: "Recently active",
  accounts: "Most accounts",
  exams: "Most exam rooms",
  newest: "Newest first",
};

export default function OwnerUniversities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const overviewQuery = useOwnerOverviewQuery();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UniversityFilter>(() => (searchParams.get("filter") === "attention" ? "attention" : "all"));
  const [sort, setSort] = useState<UniversitySort>("name");
  const [dialog, setDialog] = useState<DialogState>(() => (searchParams.get("new") === "1" ? { kind: "create" } : null));

  const universities = useMemo(() => overviewQuery.data?.universities ?? [], [overviewQuery.data]);
  const visible = useMemo(() => filterUniversities(universities, { query, filter, sort }), [universities, query, filter, sort]);
  const counts = useMemo(() => ({
    all: universities.length,
    active: universities.filter((university) => university.active).length,
    off: universities.filter((university) => !university.active).length,
    attention: universities.filter((university) => universityIssues(university).length > 0).length,
  }), [universities]);

  // The open side panel lives in the address (?open=<id>) so it survives a refresh and can be linked from the overview.
  const openId = searchParams.get("open");
  const selected = universities.find((university) => university.id === openId) ?? null;

  function setOpen(id: string | null) {
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("filter");
    if (id) next.set("open", id);
    else next.delete("open");
    setSearchParams(next, { replace: true });
  }

  function closeDialog() {
    setDialog(null);
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }

  const actions = (university: OwnerUniversity) => ({
    rename: () => setDialog({ kind: "rename", university }),
    toggle: () => setDialog({ kind: "toggle", university }),
    remove: university.id === DEFAULT_UNIVERSITY_ID ? undefined : () => setDialog({ kind: "delete", university }),
    addAdmin: (email?: string) => setDialog({ kind: "add-admin", university, email }),
    resetTwoFactor: (admin: OwnerUniversityAdmin) => setDialog({ kind: "reset-2fa", university, admin }),
  });

  const FILTERS: { value: UniversityFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "off", label: "Switched off" },
    { value: "attention", label: "Needs attention" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universities"
        description="Create universities, invite their administrators and switch access off or on. You see usage counts only, never a university's data."
        actions={<Button className="gap-2" onClick={() => setDialog({ kind: "create" })}><Plus className="h-4 w-4" /> New university</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, code or admin email" className="h-10 bg-card pl-9" aria-label="Search universities" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Filter">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === item.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span className={cn("tabular-nums", filter === item.value ? "opacity-80" : item.value === "attention" && counts.attention > 0 ? "text-warning" : "opacity-60")}>
                  {counts[item.value]}
                </span>
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as UniversitySort)}>
            <SelectTrigger className="h-10 w-44 bg-card" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as UniversitySort[]).map((value) => <SelectItem key={value} value={value}>{SORT_LABELS[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-2"><Skeleton className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/5" /></div></div>
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <ErrorState description={getErrorMessage(overviewQuery.error)} onRetry={() => void overviewQuery.refetch()} />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <p className="font-medium">{universities.length === 0 ? "No universities yet" : "No university matches"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {universities.length === 0 ? "Create the first one and invite its administrator." : "Try another search or filter."}
          </p>
          {universities.length === 0 && (
            <Button className="mt-4 gap-2" onClick={() => setDialog({ kind: "create" })}><Plus className="h-4 w-4" /> New university</Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {/* Header row (wide screens) */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_0.7fr_0.7fr_0.8fr_1fr_2.5rem] gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span>University</span><span>Status</span><span className="text-right">Accounts</span><span className="text-right">Staff</span>
            <span className="text-right">Exam rooms</span><span>Last activity</span><span />
          </div>
          <ul className="divide-y divide-border">
            {visible.map((university) => {
              const issues = universityIssues(university);
              const act = actions(university);
              return (
                <li key={university.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpen(university.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(university.id); } }}
                    className="grid cursor-pointer grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:grid-cols-[minmax(0,2.2fr)_1fr_0.7fr_0.7fr_0.8fr_1fr_2.5rem]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UniversityAvatar university={university} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{university.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{university.slug}</span> · {university.admins.length} admin{university.admins.length === 1 ? "" : "s"}
                        </div>
                        <IssueChips issues={issues} className="mt-1.5" />
                        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground md:hidden">
                          <StatusBadge active={university.active} />
                          <span>{university.accounts} accounts</span>
                          <span>{university.scheduledExamRooms} exam rooms</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block"><StatusBadge active={university.active} /></div>
                    <div className="hidden text-right tabular-nums md:block">{university.accounts.toLocaleString()}</div>
                    <div className="hidden text-right tabular-nums md:block">{university.people.toLocaleString()}</div>
                    <div className="hidden text-right tabular-nums md:block">{university.scheduledExamRooms.toLocaleString()}</div>
                    <div className="hidden text-sm text-muted-foreground md:block">{relativeTime(university.lastActivityAt ?? university.lastSignInAt)}</div>
                    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${university.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => setOpen(university.id)}>Open details</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => act.addAdmin()}><UserPlus className="mr-2 h-4 w-4" /> Add admin</DropdownMenuItem>
                          <DropdownMenuItem onSelect={act.rename}><PencilLine className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={act.toggle} className={university.active ? "text-destructive focus:text-destructive" : undefined}>
                            <Power className="mr-2 h-4 w-4" /> {university.active ? "Switch off" : "Switch on"}
                          </DropdownMenuItem>
                          {act.remove && (
                            <DropdownMenuItem onSelect={act.remove} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete university…
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setOpen(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <UniversityDetails university={selected} {...actions(selected)} />}
        </SheetContent>
      </Sheet>

      {dialog?.kind === "create" && (
        <CreateUniversityDialog onClose={closeDialog} onCreated={(result) => { setDialog({ kind: "invitation", result }); setOpen(result.university.id); }} />
      )}
      {dialog?.kind === "rename" && <RenameDialog university={dialog.university} onClose={closeDialog} />}
      {dialog?.kind === "toggle" && <ToggleDialog university={dialog.university} onClose={closeDialog} />}
      {dialog?.kind === "delete" && (
        <DeleteUniversityDialog
          university={universities.find((university) => university.id === dialog.university.id) ?? dialog.university}
          onClose={closeDialog}
          onSwitchOffFirst={() => setDialog({ kind: "toggle", university: dialog.university })}
          onDeleted={() => { closeDialog(); if (openId === dialog.university.id) setOpen(null); }}
        />
      )}
      {dialog?.kind === "add-admin" && (
        <AddAdminDialog university={dialog.university} initialEmail={dialog.email} onClose={closeDialog} onInvited={(result) => setDialog({ kind: "invitation", result })} />
      )}
      {dialog?.kind === "reset-2fa" && <ResetTwoFactorDialog university={dialog.university} admin={dialog.admin} onClose={closeDialog} />}
      {dialog?.kind === "invitation" && <InvitationDialog result={dialog.result} onClose={closeDialog} />}
    </div>
  );
}

function UniversityDetails({ university, rename, toggle, remove, addAdmin, resetTwoFactor }: {
  university: OwnerUniversity;
  rename: () => void;
  toggle: () => void;
  remove?: () => void;
  addAdmin: (email?: string) => void;
  resetTwoFactor: (admin: OwnerUniversityAdmin) => void;
}) {
  const issues = universityIssues(university);
  const usage = [
    { icon: Users, label: "Accounts", value: university.accounts },
    { icon: UsersRound, label: "Staff", value: university.people },
    { icon: DoorOpen, label: "Rooms", value: university.rooms },
    { icon: CalendarCheck, label: "Exam rooms scheduled", value: university.scheduledExamRooms },
  ];

  return (
    <div className="space-y-6">
      <SheetHeader className="space-y-3 text-left">
        <div className="flex items-center gap-3">
          <UniversityAvatar university={university} size="lg" />
          <div className="min-w-0">
            <SheetTitle className="truncate text-xl">{university.name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{university.slug}</span>
              <StatusBadge active={university.active} />
            </SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => addAdmin()}><UserPlus className="h-4 w-4" /> Add admin</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={rename}><PencilLine className="h-4 w-4" /> Rename</Button>
          <Button size="sm" variant="outline" className={cn("gap-1.5", university.active && "text-destructive hover:text-destructive")} onClick={toggle}>
            <Power className="h-4 w-4" /> {university.active ? "Switch off" : "Switch on"}
          </Button>
          {remove && (
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </SheetHeader>

      {issues.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
          <p className="mb-2 text-xs font-semibold text-warning">Needs attention</p>
          <IssueChips issues={issues} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {usage.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-muted/30 p-3">
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <div className="mt-2 font-display text-2xl font-bold tabular-nums">{item.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="font-medium">{new Date(university.createdAt).toLocaleDateString()}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last sign-in</dt><dd className="font-medium" title={university.lastSignInAt ?? undefined}>{relativeTime(university.lastSignInAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last activity</dt><dd className="font-medium" title={university.lastActivityAt ?? undefined}>{relativeTime(university.lastActivityAt)}</dd></div>
      </dl>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Administrators</h3>
          <span className="text-xs text-muted-foreground">{university.admins.length}</span>
        </div>
        {university.admins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-warning/40 p-4 text-center text-sm text-warning">
            No administrator. Add one so someone can manage this university.
          </div>
        ) : (
          <ul className="space-y-2">
            {university.admins.map((admin) => (
              <li key={admin.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(admin.displayName || admin.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{admin.displayName || admin.email}</div>
                  {admin.displayName && <div className="truncate text-xs text-muted-foreground">{admin.email}</div>}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <AdminStatusBadge admin={admin} />
                    {admin.twoFactorEnabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <ShieldCheck className="h-3 w-3" /> Two-step on
                      </span>
                    )}
                  </div>
                </div>
                {admin.enabled && !admin.signedIn ? (
                  <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => addAdmin(admin.email)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Resend
                  </Button>
                ) : admin.twoFactorEnabled ? (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => resetTwoFactor(admin)}>Reset 2FA</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        For privacy you only see counts and administrator statuses, never this university's schedules, staff or rooms.
      </p>
    </div>
  );
}
