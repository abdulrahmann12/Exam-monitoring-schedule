import { DoorOpen, MoreHorizontal, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { FormSelect } from "@/components/uniguard/FormSelect";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { HallGender, Room, RoomRequest, RoomType } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { pageOf, TablePagination } from "@/components/app/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { BulkImportDialog } from "@/components/uniguard/BulkImportDialog";
import {
    useCreateRoomMutation,
    useDeleteRoomMutation,
    useDownloadRoomsTemplateMutation,
    useRoomsQuery,
    useUpdateRoomMutation,
    useUploadRoomsBulkMutation,
} from "@/hooks";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { toast } from "sonner";

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
};

const ROOM_TYPE_BADGES: Record<RoomType, string> = {
  SMALL: "bg-muted text-muted-foreground border-border hover:bg-muted",
  MEDIUM: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  LARGE: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/15",
};

const DEFAULT_ROOM_FORM: RoomRequest = {
  name: "",
  capacity: 30,
  type: "MEDIUM",
  minInvigilators: 2,
  hallGender: "MIXED",
};

const TITLE = "Rooms";
const SUBTITLE = "Exam rooms with their capacity and staffing needs, shared by every exam period.";

type TypeFilter = "ALL" | RoomType;
type HallFilter = "ALL" | HallGender;
type SortKey = "name" | "capacity-high" | "capacity-low" | "staff-high";

const HALL_LABELS: Record<HallGender, string> = { MIXED: "Mixed", MALE: "Men only", FEMALE: "Women only" };

export default function Rooms() {
  const { canEdit } = usePermissions();
  const roomsQuery = useRoomsQuery();
  const createMutation = useCreateRoomMutation();
  const updateMutation = useUpdateRoomMutation();
  const deleteMutation = useDeleteRoomMutation();
  const uploadBulkMutation = useUploadRoomsBulkMutation();
  const downloadTemplateMutation = useDownloadRoomsTemplateMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("ALL");
  const [hall, setHall] = useState<HallFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const rooms = useMemo(() => roomsQuery.data?.items ?? [], [roomsQuery.data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rooms.filter((room) =>
      (type === "ALL" || room.type === type)
      && (hall === "ALL" || (room.hallGender ?? "MIXED") === hall)
      && (!needle || room.name.toLowerCase().includes(needle)));
    const byName = (a: Room, b: Room) => a.name.localeCompare(b.name, undefined, { numeric: true });
    const sorters: Record<SortKey, (a: Room, b: Room) => number> = {
      name: byName,
      "capacity-high": (a, b) => b.capacity - a.capacity || byName(a, b),
      "capacity-low": (a, b) => a.capacity - b.capacity || byName(a, b),
      "staff-high": (a, b) => b.minInvigilators - a.minInvigilators || byName(a, b),
    };
    return [...list].sort(sorters[sort]);
  }, [rooms, query, type, hall, sort]);

  // A new search or filter starts again at the first page.
  useEffect(() => setPage(0), [query, type, hall, sort]);

  if (roomsQuery.isLoading) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading rooms..." description="Fetching room inventory from the backend." />
      </AppLayout>
    );
  }

  if (roomsQuery.isError) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(roomsQuery.error)} onRetry={() => void roomsQuery.refetch()} />
      </AppLayout>
    );
  }

  const totalSeats = visible.reduce((sum, room) => sum + room.capacity, 0);
  const filtered = query.trim() !== "" || type !== "ALL" || hall !== "ALL";

  async function handleSubmit(payload: RoomRequest) {
    try {
      if (editingRoom) {
        await updateMutation.mutateAsync({ id: editingRoom.id, payload });
        toast.success(`${payload.name} updated.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`${payload.name} added.`);
      }

      setDialogOpen(false);
      setEditingRoom(null);
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
      showErrorToast(error, { title: "Could not delete this room." });
    }
  }

  const openEdit = (room: Room) => { setEditingRoom(room); setDialogOpen(true); };

  return (
    <AppLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={canEdit && (
        <div className="flex flex-wrap gap-2">
          <BulkImportDialog
            kind="rooms"
            existingNames={rooms.map((room) => room.name)}
            isUploading={uploadBulkMutation.isPending}
            onDownloadTemplate={() => downloadTemplateMutation.mutateAsync()}
            onUpload={({ file, duplicateStrategy }) => uploadBulkMutation.mutateAsync({ file, duplicateStrategy })}
          />
          <RoomDialog
            key={editingRoom?.id ?? "new-room"}
            open={dialogOpen}
            title={editingRoom ? `Edit ${editingRoom.name}` : "Add room"}
            initialValue={editingRoom}
            trigger={
              <Button className="gap-2" onClick={() => { setEditingRoom(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Add room
              </Button>
            }
            onOpenChange={(nextOpen) => {
              setDialogOpen(nextOpen);
              if (!nextOpen) setEditingRoom(null);
            }}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      )}
    >
      <div className="space-y-4">
        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description="Add the first room, or import them from Excel."
            action={canEdit && <Button onClick={() => setDialogOpen(true)}>Add room</Button>}
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${rooms.length} rooms`} className="h-10 bg-card pl-9" aria-label="Search rooms" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
                  <SelectTrigger className="h-10 w-36 bg-card" aria-label="Room size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All sizes</SelectItem>
                    {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((value) => <SelectItem key={value} value={value}>{ROOM_TYPE_LABELS[value]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={hall} onValueChange={(value) => setHall(value as HallFilter)}>
                  <SelectTrigger className="h-10 w-40 bg-card" aria-label="Hall"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Any hall</SelectItem>
                    {(Object.keys(HALL_LABELS) as HallGender[]).map((value) => <SelectItem key={value} value={value}>{HALL_LABELS[value]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                  <SelectTrigger className="h-10 w-44 bg-card" aria-label="Sort"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                    <SelectItem value="capacity-high">Largest first</SelectItem>
                    <SelectItem value="capacity-low">Smallest first</SelectItem>
                    <SelectItem value="staff-high">Most invigilators</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center">
                <DoorOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No room matches</p>
                <p className="mt-1 text-sm text-muted-foreground">Try another search or filter.</p>
                {filtered && <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(""); setType("ALL"); setHall("ALL"); }}>Clear filters</Button>}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                <div className="overflow-x-auto">
                  <table className="stack-table w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">Room</th>
                        <th className="px-3 py-2.5 font-medium">Seats</th>
                        <th className="px-3 py-2.5 font-medium">Size</th>
                        <th className="px-3 py-2.5 font-medium">Staff needed</th>
                        <th className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageOf(visible, page, pageSize).map((room) => (
                        <tr key={room.id} className="border-t border-border hover:bg-accent/20">
                          <td data-stack="title" className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="h-4 w-4" /></div>
                              <div className="min-w-0">
                                {canEdit
                                  ? <button type="button" onClick={() => openEdit(room)} className="truncate font-medium hover:text-primary hover:underline">{room.name}</button>
                                  : <span className="truncate font-medium">{room.name}</span>}
                                {room.hallGender && room.hallGender !== "MIXED" && (
                                  <span className="ml-2 rounded bg-shared-soft px-1.5 text-[10px] font-medium text-shared">{HALL_LABELS[room.hallGender]}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td data-label="Seats" className="px-3 py-3 tabular-nums">{room.capacity}</td>
                          <td data-label="Size" className="px-3 py-3"><Badge className={cn("border", ROOM_TYPE_BADGES[room.type])}>{ROOM_TYPE_LABELS[room.type]}</Badge></td>
                          <td data-label="Staff needed" data-stack="full" className="px-3 py-3 text-muted-foreground">1 chief + {room.minInvigilators} invigilator{room.minInvigilators === 1 ? "" : "s"}</td>
                          <td data-stack="actions" className="px-3 py-3 text-right">
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${room.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => openEdit(room)}><PencilLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setDeleting(room)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  total={visible.length}
                  noun={`rooms · ${totalSeats.toLocaleString()} seats${filtered ? ` (filtered from ${rooms.length})` : ""}`}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The room is removed for every exam period. The server refuses if exams are still scheduled in it.
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

function RoomDialog({
  open,
  title,
  initialValue,
  trigger,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  title: string;
  initialValue: Room | null;
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: RoomRequest) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [formState, setFormState] = useState<RoomRequest>(DEFAULT_ROOM_FORM);

  useEffect(() => {
    setFormState(
      initialValue
        ? {
            name: initialValue.name,
            capacity: initialValue.capacity,
            type: initialValue.type,
            minInvigilators: initialValue.minInvigilators,
            hallGender: initialValue.hallGender ?? "MIXED",
          }
        : DEFAULT_ROOM_FORM,
    );
  }, [initialValue, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Room name</Label>
            <Input value={formState.name} onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))} placeholder="Hall A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Capacity</Label>
              <Input type="number" min={1} value={formState.capacity} onChange={(event) => setFormState((previous) => ({ ...previous, capacity: Number(event.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Minimum invigilators</Label>
              <Input type="number" min={1} value={formState.minInvigilators} onChange={(event) => setFormState((previous) => ({ ...previous, minInvigilators: Number(event.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="room-type">Room type</Label>
            <FormSelect
              id="room-type"
              className="mt-2"
              value={formState.type}
              onValueChange={(value) => setFormState((previous) => ({ ...previous, type: value as RoomType }))}
              options={Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <Label htmlFor="room-hall-gender">Hall gender</Label>
            <FormSelect
              id="room-hall-gender"
              className="mt-2"
              value={formState.hallGender ?? "MIXED"}
              onValueChange={(value) => setFormState((previous) => ({ ...previous, hallGender: value as HallGender }))}
              options={[
                { value: "MIXED", label: "Mixed — anyone can supervise" },
                { value: "MALE", label: "Male hall — male staff only" },
                { value: "FEMALE", label: "Female hall — female staff only" },
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isSubmitting || !formState.name.trim() || formState.capacity <= 0 || formState.minInvigilators <= 0} onClick={() => void onSubmit({ ...formState, name: formState.name.trim() })}>
            {isSubmitting ? "Saving..." : "Save room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
