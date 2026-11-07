import { Lock, MoreHorizontal, PencilLine, Plus, RefreshCcw, Search, Trash2, TriangleAlert } from "lucide-react";
import { FormSelect } from "@/components/uniguard/FormSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { Assignment, AssignmentRequest, Person, Room, TimeSlot } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { pageOf, TablePagination } from "@/components/app/TablePagination";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/uniguard/AppLayout";
import {
    useAssignmentsQuery,
    useCreateAssignmentMutation,
    useDeleteAllAssignmentsMutation,
    useDeleteAssignmentMutation,
    usePeopleQuery,
    useRoomsQuery,
    useTimeSlotsQuery,
    useUpdateAssignmentMutation,
} from "@/hooks";
import { formatDay } from "@/lib/dashboard/insights";
import { byStartTime, hhmm } from "@/lib/timeSlots";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { toast } from "sonner";

interface AssignmentFormState {
  examDate: string;
  roomId: string;
  timeSlotId: string;
  subjectName: string;
  subjectCode: string;
  chiefInvigilatorId: string;
  locked: boolean;
  invigilatorIds: string[];
}

const TITLE = "Assignments";
const SUBTITLE = "Every exam room of the selected exam period, as one searchable list.";
const ALL = "ALL";

/** What a row still needs: no chief, and/or empty required invigilator seats. */
function staffingGap(assignment: Assignment): string | null {
  const missing = assignment.invigilators.filter((seat) => seat.required && !seat.invigilatorId).length;
  const parts = [assignment.chiefInvigilatorId ? null : "No chief", missing > 0 ? `${missing} invigilator${missing === 1 ? "" : "s"} missing` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default function AssignmentsPage() {
  const { canEdit } = usePermissions();
  const { error: groupError, isLoading: groupsLoading, refetch: refetchGroups, activeGroup } = useScheduleGroup();
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState(ALL);
  const [slotFilter, setSlotFilter] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  const assignmentsQuery = useAssignmentsQuery({
    page: 0,
    size: 500,
    sortBy: "examDate",
    direction: "ASC",
  }); // the whole exam period; the filters below work on screen, so their lists can show what is scheduled
  const peopleQuery = usePeopleQuery();
  const roomsQuery = useRoomsQuery();
  const timeSlotsQuery = useTimeSlotsQuery({ page: 0, size: 100, sortBy: "sortOrder", direction: "ASC" });
  const createMutation = useCreateAssignmentMutation();
  const updateMutation = useUpdateAssignmentMutation();
  const deleteAllMutation = useDeleteAllAssignmentsMutation();
  const deleteMutation = useDeleteAssignmentMutation();

  const slotsById = useMemo(() => new Map((timeSlotsQuery.data?.items ?? []).map((slot) => [slot.id, slot])), [timeSlotsQuery.data]);
  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return (assignmentsQuery.data?.items ?? [])
      .filter((assignment) => roomFilter === ALL || assignment.roomId === roomFilter)
      .filter((assignment) => slotFilter === ALL || assignment.timeSlotId === slotFilter)
      .filter((assignment) => (!fromDate || assignment.examDate >= fromDate) && (!toDate || assignment.examDate <= toDate))
      .filter((assignment) => !onlyGaps || staffingGap(assignment) !== null)
      .filter((assignment) => !needle || [
        assignment.roomName,
        assignment.slotLabel,
        assignment.subjectName ?? "",
        assignment.subjectCode ?? "",
        assignment.chiefInvigilatorName ?? "",
        ...assignment.invigilators.map((invigilator) => invigilator.invigilatorName ?? ""),
      ].some((value) => value.toLowerCase().includes(needle)))
      .sort((a, b) => a.examDate.localeCompare(b.examDate)
        || (a.startTime ?? "").localeCompare(b.startTime ?? "")
        || a.roomName.localeCompare(b.roomName, undefined, { numeric: true }));
  }, [assignmentsQuery.data, searchQuery, onlyGaps, roomFilter, slotFilter, fromDate, toDate]);

  // Filter choices: only the slots and rooms that have exams in this exam period, with how many.
  const usedSlots = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignmentsQuery.data?.items ?? []) counts.set(assignment.timeSlotId, (counts.get(assignment.timeSlotId) ?? 0) + 1);
    return [...(timeSlotsQuery.data?.items ?? [])].filter((slot) => counts.has(slot.id)).sort(byStartTime).map((slot) => ({ slot, count: counts.get(slot.id) ?? 0 }));
  }, [assignmentsQuery.data, timeSlotsQuery.data]);
  const usedRooms = useMemo(() => {
    const byRoom = new Map<string, { id: string; name: string; count: number }>();
    for (const assignment of assignmentsQuery.data?.items ?? []) {
      const entry = byRoom.get(assignment.roomId) ?? { id: assignment.roomId, name: assignment.roomName, count: 0 };
      entry.count += 1;
      byRoom.set(assignment.roomId, entry);
    }
    return [...byRoom.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [assignmentsQuery.data]);

  // A new search or filter starts again at the first page.
  useEffect(() => setPage(0), [searchQuery, roomFilter, slotFilter, fromDate, toDate, onlyGaps]);

  const anyLoading = groupsLoading || assignmentsQuery.isPending || peopleQuery.isLoading || roomsQuery.isLoading || timeSlotsQuery.isPending;
  const error = groupError ?? assignmentsQuery.error ?? peopleQuery.error ?? roomsQuery.error ?? timeSlotsQuery.error;

  if (groupError) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(groupError)} onRetry={() => void refetchGroups()} />
      </AppLayout>
    );
  }

  if (anyLoading) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading assignments..." description="Fetching assignments and their lookup data." />
      </AppLayout>
    );
  }

  if (assignmentsQuery.isError || peopleQuery.isError || roomsQuery.isError || timeSlotsQuery.isError) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState
          description={getErrorMessage(error)}
          onRetry={() => {
            void assignmentsQuery.refetch();
            void peopleQuery.refetch();
            void roomsQuery.refetch();
            void timeSlotsQuery.refetch();
          }}
        />
      </AppLayout>
    );
  }

  const people = peopleQuery.data?.items ?? [];
  const rooms = roomsQuery.data?.items ?? [];
  const timeSlots = [...(timeSlotsQuery.data?.items ?? [])].sort(byStartTime);
  const loaded = assignmentsQuery.data?.items ?? [];
  const gapsInLoaded = loaded.filter((assignment) => staffingGap(assignment) !== null).length;
  const canCreateAssignment = rooms.length > 0 && timeSlots.length > 0;
  const filtered = searchQuery.trim() !== "" || roomFilter !== ALL || slotFilter !== ALL || fromDate !== "" || toDate !== "" || onlyGaps;
  const periodName = activeGroup?.name ?? "";

  function resetFilters() {
    setSearchQuery("");
    setRoomFilter(ALL);
    setSlotFilter(ALL);
    setFromDate("");
    setToDate("");
    setOnlyGaps(false);
  }

  async function handleSubmit(payload: AssignmentRequest) {
    try {
      if (editingAssignment) {
        await updateMutation.mutateAsync({ id: editingAssignment.id, payload });
        toast.success("Assignment updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Assignment created.");
      }

      setDialogOpen(false);
      setEditingAssignment(null);
    } catch (errorValue) {
      showErrorToast(errorValue);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`${deleting.roomName} on ${formatDay(deleting.examDate)} deleted.`);
      setDeleting(null);
    } catch (errorValue) {
      showErrorToast(errorValue, { title: "Could not delete the assignment." });
    }
  }

  async function confirmClear() {
    try {
      const result = await deleteAllMutation.mutateAsync();
      toast.success(result.deleted === 0 ? "There was nothing to delete." : `Deleted all ${result.deleted} exam rooms of ${periodName}.`);
      setClearOpen(false);
      setClearConfirmText("");
    } catch (errorValue) {
      showErrorToast(errorValue, { title: "Nothing was deleted." });
    }
  }

  const openEdit = (assignment: Assignment) => { setEditingAssignment(assignment); setDialogOpen(true); };

  return (
    <AppLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={canEdit && (
        <div className="flex flex-wrap gap-2">
          <AssignmentDialog
            key={editingAssignment?.id ?? "new-assignment"}
            open={dialogOpen}
            title={editingAssignment ? "Edit assignment" : "Add assignment"}
            initialValue={editingAssignment}
            people={people}
            rooms={rooms}
            timeSlots={timeSlots}
            trigger={
              <Button className="gap-2" disabled={!canCreateAssignment || deleteAllMutation.isPending} onClick={() => { setEditingAssignment(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Add assignment
              </Button>
            }
            onOpenChange={(nextOpen) => {
              setDialogOpen(nextOpen);
              if (!nextOpen) setEditingAssignment(null);
            }}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={loaded.length === 0} onSelect={() => setClearOpen(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete all of {periodName || "this exam period"}…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search subject, room or staff" className="h-10 pl-9" aria-label="Search assignments" />
            </div>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="h-10 lg:w-48" aria-label="Room"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All rooms</SelectItem>
                {usedRooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.name} <span className="text-muted-foreground">({room.count})</span></SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={slotFilter} onValueChange={setSlotFilter}>
              <SelectTrigger className="h-10 lg:w-56" aria-label="Time slot"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All time slots</SelectItem>
                {usedSlots.map(({ slot, count }) => <SelectItem key={slot.id} value={slot.id}>{hhmm(slot.startTime)}–{hhmm(slot.endTime)}{slot.label ? ` · ${slot.label}` : ""} <span className="text-muted-foreground">({count})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              From
              <Input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="h-9 w-40" aria-label="From date" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              To
              <Input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="h-9 w-40" aria-label="To date" />
            </label>
            <Button
              type="button"
              variant={onlyGaps ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              aria-pressed={onlyGaps}
              onClick={() => setOnlyGaps((value) => !value)}
            >
              <TriangleAlert className="h-4 w-4" /> Needs staff
              {gapsInLoaded > 0 && <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", onlyGaps ? "bg-primary-foreground/20" : "bg-warning/15 text-warning")}>{gapsInLoaded}</span>}
            </Button>
            {filtered && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={resetFilters}><RefreshCcw className="h-4 w-4" /> Clear filters</Button>
            )}
          </div>
        </div>

        {!canCreateAssignment && visible.length === 0 ? (
          <EmptyState title="Assignments are not ready" description="Create at least one room and one time slot before adding assignments." />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filtered ? "Nothing matches" : "No assignments yet"}
            description={filtered ? "Try another search or clear the filters." : "Use the Scheduler to generate them, or add one by hand."}
            action={filtered ? <Button variant="outline" onClick={resetFilters}>Clear filters</Button> : canEdit && <Button onClick={() => setDialogOpen(true)}>Add assignment</Button>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="stack-table w-full min-w-[900px] text-sm">
                <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Time</th>
                    <th className="px-3 py-2.5 font-medium">Room</th>
                    <th className="px-3 py-2.5 font-medium">Subject</th>
                    <th className="px-3 py-2.5 font-medium">Chief</th>
                    <th className="px-3 py-2.5 font-medium">Invigilators</th>
                    <th className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(visible, page, pageSize).map((assignment) => {
                    const slot = slotsById.get(assignment.timeSlotId);
                    const gap = staffingGap(assignment);
                    const names = assignment.invigilators.map((seat) => seat.invigilatorName).filter(Boolean);
                    return (
                      <tr key={assignment.id} className={cn("border-t border-border hover:bg-accent/20", gap && "bg-warning/[0.03]")}>
                        <td data-label="Date" className="whitespace-nowrap px-4 py-3 font-medium">{formatDay(assignment.examDate)}</td>
                        <td data-label="Time" className="whitespace-nowrap px-3 py-3">
                          <div className="tabular-nums">{hhmm(assignment.startTime ?? slot?.startTime ?? "")}–{hhmm(assignment.endTime ?? slot?.endTime ?? "")}</div>
                          {assignment.slotLabel && <div className="text-[11px] text-muted-foreground">{assignment.slotLabel}</div>}
                        </td>
                        <td data-label="Room" className="whitespace-nowrap px-3 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            {assignment.locked && <Lock className="h-3.5 w-3.5 text-warning" aria-label="Locked" />}
                            {assignment.roomName}
                          </span>
                        </td>
                        <td data-label="Subject" className="px-3 py-3 text-xs">
                          {assignment.subjectName || assignment.subjectCode ? (
                            <>
                              <div className="font-medium">{assignment.subjectName || assignment.subjectCode}</div>
                              {assignment.subjectName && assignment.subjectCode && <div className="text-muted-foreground">{assignment.subjectCode}</div>}
                            </>
                          ) : <span className="text-muted-foreground/60">—</span>}
                        </td>
                        <td data-label="Chief" data-stack="full" className="px-3 py-3">{assignment.chiefInvigilatorName ?? <span className="text-muted-foreground/60">—</span>}</td>
                        <td data-label="Invigilators" data-stack="full" className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {names.length > 0 && <span>{names.join(", ")}</span>}
                            {gap && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                                <TriangleAlert className="h-3 w-3" /> {gap}
                              </span>
                            )}
                            {assignment.source === "MANUAL" && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">Manual</span>}
                          </div>
                        </td>
                        <td data-stack="actions" className="px-3 py-3 text-right">
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${assignment.roomName} on ${assignment.examDate}`}><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => openEdit(assignment)}><PencilLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setDeleting(assignment)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={visible.length}
              noun={`exam rooms${filtered ? ` (filtered from ${loaded.length})` : ""}${gapsInLoaded > 0 && !onlyGaps ? ` · ${gapsInLoaded} need staff` : ""}`}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.roomName} on {deleting && formatDay(deleting.examDate)}?</AlertDialogTitle>
            <AlertDialogDescription>The exam room and its staff assignments are removed from this exam period. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={(open) => { setClearOpen(open); if (!open) setClearConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every exam room of “{periodName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              All {loaded.length} assignments of this exam period are removed in one step. Other exam periods,
              people, rooms and time slots are not touched. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="clear-confirm" className="text-xs">Type <span className="font-semibold">{periodName}</span> to confirm</Label>
            <Input id="clear-confirm" value={clearConfirmText} onChange={(event) => setClearConfirmText(event.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAllMutation.isPending || clearConfirmText.trim() !== periodName.trim() || !periodName}
              onClick={(event) => { event.preventDefault(); void confirmClear(); }}
            >
              {deleteAllMutation.isPending ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function AssignmentDialog({
  open,
  title,
  initialValue,
  people,
  rooms,
  timeSlots,
  trigger,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  title: string;
  initialValue: Assignment | null;
  people: Person[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AssignmentRequest) => Promise<void>;
  isSubmitting: boolean;
}) {
  const chiefs = useMemo(() => people.filter((person) => person.role === "CHIEF_INVIGILATOR"), [people]);
  const invigilators = useMemo(() => people.filter((person) => person.role === "INVIGILATOR"), [people]);
  const [formState, setFormState] = useState<AssignmentFormState>({
    examDate: "",
    roomId: rooms[0]?.id ?? "",
    timeSlotId: timeSlots[0]?.id ?? "",
    subjectName: "",
    subjectCode: "",
    chiefInvigilatorId: "",
    locked: false,
    invigilatorIds: [""],
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(
      initialValue
        ? {
            examDate: initialValue.examDate,
            roomId: initialValue.roomId,
            timeSlotId: initialValue.timeSlotId,
            subjectName: initialValue.subjectName ?? "",
            subjectCode: initialValue.subjectCode ?? "",
            chiefInvigilatorId: initialValue.chiefInvigilatorId ?? "",
            locked: initialValue.locked,
            invigilatorIds: initialValue.invigilators.map((invigilator) => invigilator.invigilatorId ?? ""),
          }
        : {
            examDate: "",
            roomId: rooms[0]?.id ?? "",
            timeSlotId: timeSlots[0]?.id ?? "",
            subjectName: "",
            subjectCode: "",
            chiefInvigilatorId: chiefs[0]?.id ?? "",
            locked: false,
            invigilatorIds: [""],
          },
    );
  }, [chiefs, initialValue, open, rooms, timeSlots]);

  const requiredInvigilators = Math.max(1, rooms.find((room) => room.id === formState.roomId)?.minInvigilators ?? 1);

  useEffect(() => {
    setFormState((previous) => {
      const nextInvigilatorIds = Array.from({ length: requiredInvigilators }, (_, index) => previous.invigilatorIds[index] ?? "");
      const unchanged = nextInvigilatorIds.length === previous.invigilatorIds.length && nextInvigilatorIds.every((value, index) => value === previous.invigilatorIds[index]);

      if (unchanged) {
        return previous;
      }

      return {
        ...previous,
        invigilatorIds: nextInvigilatorIds,
      };
    });
  }, [requiredInvigilators]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Exam date</Label>
            <Input type="date" value={formState.examDate} onChange={(event) => setFormState((previous) => ({ ...previous, examDate: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="assignment-slot">Time slot</Label>
            <FormSelect
              id="assignment-slot"
              className="mt-2"
              value={formState.timeSlotId}
              onValueChange={(value) => setFormState((previous) => ({ ...previous, timeSlotId: value }))}
              options={timeSlots.map((timeSlot) => ({ value: timeSlot.id, label: timeSlot.label }))}
              placeholder="Choose a time slot"
            />
          </div>
          <div>
            <Label htmlFor="assignment-room">Room</Label>
            <FormSelect
              id="assignment-room"
              className="mt-2"
              value={formState.roomId}
              onValueChange={(value) => setFormState((previous) => ({ ...previous, roomId: value }))}
              options={rooms.map((room) => ({ value: room.id, label: room.name }))}
              placeholder="Choose a room"
            />
          </div>
          <div>
            <Label htmlFor="assignment-chief">Chief invigilator</Label>
            <FormSelect
              id="assignment-chief"
              className="mt-2"
              value={formState.chiefInvigilatorId}
              onValueChange={(value) => setFormState((previous) => ({ ...previous, chiefInvigilatorId: value }))}
              options={[{ value: "", label: "Unassigned" }, ...chiefs.map((chief) => ({ value: chief.id, label: chief.name }))]}
            />
          </div>
          <div>
            <Label>Subject name</Label>
            <Input value={formState.subjectName} onChange={(event) => setFormState((previous) => ({ ...previous, subjectName: event.target.value }))} placeholder="Calculus I" />
          </div>
          <div>
            <Label>Subject code</Label>
            <Input value={formState.subjectCode} onChange={(event) => setFormState((previous) => ({ ...previous, subjectCode: event.target.value }))} placeholder="MATH101" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Invigilator positions</div>
          {formState.invigilatorIds.map((invigilatorId, index) => (
            <div key={index}>
              <Label htmlFor={`assignment-position-${index}`}>Position {index + 1}</Label>
              <FormSelect
                id={`assignment-position-${index}`}
                className="mt-2"
                value={invigilatorId}
                onValueChange={(next) => setFormState((previous) => ({ ...previous, invigilatorIds: previous.invigilatorIds.map((value, valueIndex) => valueIndex === index ? next : value) }))}
                options={[{ value: "", label: "Empty slot" }, ...invigilators.map((invigilator) => ({ value: invigilator.id, label: invigilator.name }))]}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={formState.locked} onChange={(event) => setFormState((previous) => ({ ...previous, locked: event.target.checked }))} />
            Lock this assignment against partial regeneration.
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={isSubmitting || !formState.examDate || !formState.roomId || !formState.timeSlotId}
            onClick={() =>
              void onSubmit({
                examDate: formState.examDate,
                roomId: formState.roomId,
                timeSlotId: formState.timeSlotId,
                subjectName: formState.subjectName.trim() || null,
                subjectCode: formState.subjectCode.trim() || null,
                chiefInvigilatorId: formState.chiefInvigilatorId || null,
                locked: formState.locked,
                source: "MANUAL",
                invigilatorIds: formState.invigilatorIds.map((invigilatorId) => invigilatorId || null),
              })
            }
          >
            {isSubmitting ? "Saving..." : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}