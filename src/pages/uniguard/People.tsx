import { CalendarOff, MoreHorizontal, PencilLine, Plus, Search, Trash2, UserCog, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { Person, PersonRequest, PersonRole } from "@/api";
import { ErrorState, LoadingState } from "@/components/app/PageState";
import { pageOf, TablePagination } from "@/components/app/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { BulkImportDialog } from "@/components/uniguard/BulkImportDialog";
import { PersonDialog } from "@/components/uniguard/PersonDialog";
import {
  useCreatePersonMutation,
  useDeletePersonMutation,
  useDownloadPeopleTemplateMutation,
  usePeopleQuery,
  useUpdatePersonMutation,
  useUploadPeopleBulkMutation,
} from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { DAYS } from "@/lib/uniguard/types";
import { cn } from "@/lib/utils";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const TITLE = "People";
const SUBTITLE = "Chief invigilators and invigilators, shared by every exam period. Workload counts the selected period.";

type RoleFilter = "ALL" | PersonRole;
type SortKey = "name" | "workload-high" | "workload-low" | "department";

export default function People() {
  const { canEdit } = usePermissions();
  const peopleQuery = usePeopleQuery();
  const createMutation = useCreatePersonMutation();
  const updateMutation = useUpdatePersonMutation();
  const deleteMutation = useDeletePersonMutation();
  const uploadBulkMutation = useUploadPeopleBulkMutation();
  const downloadTemplateMutation = useDownloadPeopleTemplateMutation();
  const [dialog, setDialog] = useState<{ open: boolean; person: Person | null; role: PersonRole }>({ open: false, person: null, role: "CHIEF_INVIGILATOR" });
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const people = useMemo(() => peopleQuery.data?.items ?? [], [peopleQuery.data]);
  const departments = useMemo(() => [...new Set(people.map((person) => person.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [people]);
  const counts = useMemo(() => ({
    ALL: people.length,
    CHIEF_INVIGILATOR: people.filter((person) => person.role === "CHIEF_INVIGILATOR").length,
    INVIGILATOR: people.filter((person) => person.role === "INVIGILATOR").length,
  }), [people]);
  const averageLoad = useMemo(() => people.reduce((sum, person) => sum + person.totalAssignments, 0) / Math.max(1, people.length), [people]);
  const maxLoad = useMemo(() => Math.max(1, ...people.map((person) => person.totalAssignments)), [people]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = people.filter((person) => {
      if (role !== "ALL" && person.role !== role) return false;
      if (department !== "ALL" && person.department !== department) return false;
      if (!needle) return true;
      return [person.name, person.email, person.department, ...(person.subjectCodes ?? [])].some((text) => (text ?? "").toLowerCase().includes(needle));
    });
    const byName = (a: Person, b: Person) => a.name.replace(/^Dr\.\s*/i, "").localeCompare(b.name.replace(/^Dr\.\s*/i, ""));
    const sorters: Record<SortKey, (a: Person, b: Person) => number> = {
      name: byName,
      "workload-high": (a, b) => b.totalAssignments - a.totalAssignments || byName(a, b),
      "workload-low": (a, b) => a.totalAssignments - b.totalAssignments || byName(a, b),
      department: (a, b) => a.department.localeCompare(b.department) || byName(a, b),
    };
    return [...list].sort(sorters[sort]);
  }, [people, role, department, query, sort]);

  // A new search or filter starts again at the first page.
  useEffect(() => setPage(0), [role, department, query, sort]);

  if (peopleQuery.isLoading) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading people..." description="Retrieving the people directory." />
      </AppLayout>
    );
  }

  if (peopleQuery.isError) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(peopleQuery.error)} onRetry={() => void peopleQuery.refetch()} />
      </AppLayout>
    );
  }

  const openAdd = () => setDialog({ open: true, person: null, role: role === "INVIGILATOR" ? "INVIGILATOR" : "CHIEF_INVIGILATOR" });

  async function handleSubmit(payload: PersonRequest) {
    try {
      if (dialog.person) {
        await updateMutation.mutateAsync({ id: dialog.person.id, payload });
        toast.success(`${payload.name} updated.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`${payload.name} added.`);
      }
      setDialog((previous) => ({ ...previous, open: false }));
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
    } catch (error) {
      showErrorToast(error, { title: "Could not delete this person." });
    }
  }

  const filtered = query.trim() !== "" || department !== "ALL" || role !== "ALL";
  const ROLE_TABS: Array<{ value: RoleFilter; label: string; icon: typeof Users }> = [
    { value: "ALL", label: "Everyone", icon: Users },
    { value: "CHIEF_INVIGILATOR", label: "Chief invigilators", icon: UserCog },
    { value: "INVIGILATOR", label: "Invigilators", icon: Users },
  ];

  return (
    <AppLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={canEdit && (
        <div className="flex flex-wrap gap-2">
          <BulkImportDialog
            kind="persons"
            existingNames={people.map((person) => person.name)}
            isUploading={uploadBulkMutation.isPending}
            onDownloadTemplate={() => downloadTemplateMutation.mutateAsync()}
            onUpload={({ file, duplicateStrategy }) => uploadBulkMutation.mutateAsync({ file, duplicateStrategy })}
          />
          <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> Add person</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex w-fit rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Role">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={role === tab.value}
                onClick={() => setRole(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  role === tab.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" /> {tab.label}
                <span className={cn("rounded px-1.5 text-[11px] tabular-nums", role === tab.value ? "bg-primary-foreground/20" : "bg-muted")}>{counts[tab.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, department or subject" className="h-10 bg-card pl-9" aria-label="Search people" />
          </div>
          <div className="flex gap-2">
            {departments.length > 1 && (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-10 w-44 bg-card" aria-label="Department"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All departments</SelectItem>
                  {departments.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="h-10 w-44 bg-card" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="workload-high">Most duties first</SelectItem>
                <SelectItem value="workload-low">Fewest duties first</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{people.length === 0 ? "No people yet" : "Nobody matches"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {people.length === 0 ? "Add chief invigilators and invigilators, or import them from Excel." : "Try another search or filter."}
            </p>
            {people.length === 0 && canEdit && <Button className="mt-4 gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> Add person</Button>}
            {filtered && people.length > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(""); setDepartment("ALL"); setRole("ALL"); }}>Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Person</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium">Available</th>
                    <th className="px-3 py-2.5 font-medium">Duties this period</th>
                    <th className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(visible, page, pageSize).map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      maxLoad={maxLoad}
                      averageLoad={averageLoad}
                      canEdit={canEdit}
                      onEdit={() => setDialog({ open: true, person, role: person.role })}
                      onDelete={() => setDeleting(person)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={visible.length}
              noun={visible.length === people.length ? "people" : `people (filtered from ${people.length})`}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <PersonDialog
        open={dialog.open}
        person={dialog.person}
        defaultRole={dialog.role}
        departments={departments}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => setDialog((previous) => ({ ...previous, open }))}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.totalAssignments > 0
                ? `${deleting.name} has ${deleting.totalAssignments} duties in this exam period. Deleting removes them from the directory; the server refuses if they are still assigned anywhere.`
                : "They are removed from the people directory. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function PersonRow({ person, maxLoad, averageLoad, canEdit, onEdit, onDelete }: {
  person: Person;
  maxLoad: number;
  averageLoad: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const chief = person.role === "CHIEF_INVIGILATOR";
  const heavy = person.totalAssignments > Math.max(2, Math.ceil(averageLoad * 1.5));
  const initials = person.name.replace(/^Dr\.\s*/i, "").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <tr className="border-t border-border hover:bg-accent/20">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold", chief ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>{initials}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {canEdit
                ? <button type="button" onClick={onEdit} className="truncate font-medium hover:text-primary hover:underline">{person.name}</button>
                : <span className="truncate font-medium">{person.name}</span>}
              <span className={cn("rounded px-1.5 text-[10px] font-medium", chief ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>{chief ? "Chief" : "Invigilator"}</span>
              {person.gender && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">{person.gender === "FEMALE" ? "Female" : "Male"}</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {person.email || <span className="italic text-muted-foreground/70">No email</span>}
              {(person.subjectCodes?.length ?? 0) > 0 && <span> · teaches {person.subjectCodes!.join(", ")}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{person.department}</td>
      <td className="px-3 py-3">
        <div className="flex gap-0.5" aria-label={`Available: ${person.availableDays.join(", ") || "no days"}`}>
          {DAYS.map((day) => {
            const on = person.availableDays.includes(day);
            return (
              <span key={day} title={day} className={cn("grid h-6 w-6 place-items-center rounded text-[10px] font-medium", on ? "bg-primary/10 text-primary" : "text-muted-foreground/40")}>
                {day.slice(0, 2)}
              </span>
            );
          })}
        </div>
        {person.availableDays.length === 0 && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-warning"><CalendarOff className="h-3 w-3" /> Never available</div>}
      </td>
      <td className="w-56 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", heavy ? "bg-warning" : chief ? "bg-chief" : "bg-invigilator")} style={{ width: `${(person.totalAssignments / maxLoad) * 100}%` }} />
          </div>
          <span className={cn("w-16 text-right text-xs font-semibold tabular-nums", heavy && "text-warning")} title={heavy ? "Well above the average workload" : undefined}>
            {person.totalAssignments} {person.totalAssignments === 1 ? "duty" : "duties"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${person.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><PencilLine className="mr-2 h-4 w-4" /> Edit, leave dates</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}
