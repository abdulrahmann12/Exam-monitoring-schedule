import { LoaderCircle, PencilLine, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { Assignment, AssignmentRequest, Person, Room, TimeSlot } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function AssignmentsPage() {
  const { error: groupError, isLoading: groupsLoading, refetch: refetchGroups } = useScheduleGroup();
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const assignmentsQuery = useAssignmentsQuery({
    page: 0,
    size: 100,
    sortBy: "examDate",
    direction: "ASC",
    roomId: roomFilter || undefined,
    slotId: slotFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });
  const peopleQuery = usePeopleQuery();
  const roomsQuery = useRoomsQuery();
  const timeSlotsQuery = useTimeSlotsQuery({
    page: 0,
    size: 100,
    sortBy: "sortOrder",
    direction: "ASC",
  });
  const createMutation = useCreateAssignmentMutation();
  const updateMutation = useUpdateAssignmentMutation();
  const deleteAllMutation = useDeleteAllAssignmentsMutation();
  const deleteMutation = useDeleteAssignmentMutation();

  const anyLoading = groupsLoading || assignmentsQuery.isPending || peopleQuery.isLoading || roomsQuery.isLoading || timeSlotsQuery.isPending;
  const error = groupError ?? assignmentsQuery.error ?? peopleQuery.error ?? roomsQuery.error ?? timeSlotsQuery.error;

  if (groupError) {
    return (
      <AppLayout title="Assignments" subtitle="Manage room assignments for the selected exam period.">
        <ErrorState description={getErrorMessage(groupError)} onRetry={() => void refetchGroups()} />
      </AppLayout>
    );
  }

  if (anyLoading) {
    return (
      <AppLayout title="Assignments" subtitle="Manage room assignments for the selected exam period.">
        <LoadingState title="Loading assignments..." description="Fetching assignments and their lookup data." />
      </AppLayout>
    );
  }

  if (assignmentsQuery.isError || peopleQuery.isError || roomsQuery.isError || timeSlotsQuery.isError) {
    return (
      <AppLayout title="Assignments" subtitle="Manage room assignments for the selected exam period.">
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
  const timeSlots = timeSlotsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const canCreateAssignment = rooms.length > 0 && timeSlots.length > 0;

  const filteredAssignments = assignments.filter((assignment) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [
      assignment.roomName,
      assignment.slotLabel,
      assignment.subjectName ?? "",
      assignment.subjectCode ?? "",
      assignment.chiefInvigilatorName ?? "",
      ...assignment.invigilators.map((invigilator) => invigilator.invigilatorName ?? ""),
    ].some((value) => value.toLowerCase().includes(query));
  });

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

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Assignment deleted.");
    } catch (errorValue) {
      showErrorToast(errorValue);
    }
  }

  async function handleDeleteAll() {
    try {
      const result = await deleteAllMutation.mutateAsync();
      setDeleteAllOpen(false);

      if (result.total === 0) {
        toast.warning("No assignments to delete.");
        return;
      }

      if (result.failed === 0) {
        toast.success(`${result.deleted} assignments deleted.`);
        return;
      }

      toast.warning(`Deleted ${result.deleted} assignments, ${result.failed} failed.`, {
        description: result.firstError ?? "Some assignments could not be removed.",
      });
    } catch (errorValue) {
      showErrorToast(errorValue, { title: "Could not delete all assignments." });
    }
  }

  return (
    <AppLayout
      title="Assignments"
      subtitle="Manage room assignments for the selected exam period."
      actions={
        <div className="flex flex-wrap gap-2">
          <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={deleteAllMutation.isPending}>
                {deleteAllMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all assignments?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes every saved assignment in the system in one pass. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteAllMutation.isPending}>Cancel</AlertDialogCancel>
                <Button variant="destructive" disabled={deleteAllMutation.isPending} onClick={() => void handleDeleteAll()}>
                  {deleteAllMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleteAllMutation.isPending ? "Deleting..." : "Delete all assignments"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AssignmentDialog
            key={editingAssignment?.id ?? "new-assignment"}
            open={dialogOpen}
            title={editingAssignment ? "Edit assignment" : "Add assignment"}
            initialValue={editingAssignment}
            people={people}
            rooms={rooms}
            timeSlots={timeSlots}
            trigger={
              <Button
                className="gap-2"
                disabled={!canCreateAssignment || deleteAllMutation.isPending}
                onClick={() => {
                  setEditingAssignment(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add assignment
              </Button>
            }
            onOpenChange={(nextOpen) => {
              setDialogOpen(nextOpen);
              if (!nextOpen) {
                setEditingAssignment(null);
              }
            }}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      }
    >
      <div className="mb-5 grid gap-3 lg:grid-cols-5">
        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search subject or staff..." />
        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
          <option value="">All rooms</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={slotFilter} onChange={(event) => setSlotFilter(event.target.value)}>
          <option value="">All time slots</option>
          {timeSlots.map((timeSlot) => (
            <option key={timeSlot.id} value={timeSlot.id}>{timeSlot.label}</option>
          ))}
        </select>
        <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <div className="flex gap-2">
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <Button variant="outline" className="gap-2" onClick={() => { setSearchQuery(""); setRoomFilter(""); setSlotFilter(""); setFromDate(""); setToDate(""); }}>
            <RefreshCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {!canCreateAssignment && filteredAssignments.length === 0 ? (
        <EmptyState
          title="Assignments are not ready"
          description="Create at least one room and one time slot before adding assignments."
        />
      ) : filteredAssignments.length === 0 ? (
        <EmptyState
          title="No assignments found"
          description="Broaden the filters or create a new assignment."
          action={<Button onClick={() => setDialogOpen(true)}>Create assignment</Button>}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Time slot</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Chief</th>
                <th className="px-4 py-3 font-medium">Invigilators</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="border-t border-border hover:bg-accent/20 transition-smooth">
                  <td className="px-4 py-3 font-medium">{assignment.examDate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{assignment.slotLabel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{assignment.roomName}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{assignment.subjectName || "Unlabeled subject"}</div>
                    <div className="text-xs text-muted-foreground">{assignment.subjectCode || "No subject code"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{assignment.chiefInvigilatorName || "Unassigned"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {assignment.invigilators.length > 0
                      ? assignment.invigilators.map((invigilator) => invigilator.invigilatorName || "Empty slot").join(", ")
                      : "No invigilators"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={assignment.locked ? "default" : "secondary"}>{assignment.locked ? "Locked" : "Unlocked"}</Badge>
                      <Badge variant="outline">{assignment.source}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingAssignment(assignment); setDialogOpen(true); }}>
                        <PencilLine className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-busy={deleteMutation.getIsPending(assignment.id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deleteAllMutation.isPending || deleteMutation.getIsLocked(assignment.id)}
                        onClick={() => void handleDelete(assignment.id)}
                      >
                        {deleteMutation.getIsPending(assignment.id) ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Exam date</Label>
            <Input type="date" value={formState.examDate} onChange={(event) => setFormState((previous) => ({ ...previous, examDate: event.target.value }))} />
          </div>
          <div>
            <Label>Time slot</Label>
            <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.timeSlotId} onChange={(event) => setFormState((previous) => ({ ...previous, timeSlotId: event.target.value }))}>
              {timeSlots.map((timeSlot) => (
                <option key={timeSlot.id} value={timeSlot.id}>{timeSlot.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Room</Label>
            <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.roomId} onChange={(event) => setFormState((previous) => ({ ...previous, roomId: event.target.value }))}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Chief invigilator</Label>
            <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.chiefInvigilatorId} onChange={(event) => setFormState((previous) => ({ ...previous, chiefInvigilatorId: event.target.value }))}>
              <option value="">Unassigned</option>
              {chiefs.map((chief) => (
                <option key={chief.id} value={chief.id}>{chief.name}</option>
              ))}
            </select>
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
              <Label>Position {index + 1}</Label>
              <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={invigilatorId} onChange={(event) => setFormState((previous) => ({ ...previous, invigilatorIds: previous.invigilatorIds.map((value, valueIndex) => valueIndex === index ? event.target.value : value) }))}>
                <option value="">Empty slot</option>
                {invigilators.map((invigilator) => (
                  <option key={invigilator.id} value={invigilator.id}>{invigilator.name}</option>
                ))}
              </select>
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