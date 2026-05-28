import { DoorOpen, PencilLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { Room, RoomRequest, RoomType } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { BulkUploadCard } from "@/components/uniguard/BulkUploadCard";
import {
    useCreateRoomMutation,
    useDeleteRoomMutation,
    useDownloadRoomsTemplateMutation,
    useRoomsQuery,
    useUpdateRoomMutation,
    useUploadRoomsBulkMutation,
} from "@/hooks";
import { cn } from "@/lib/utils";
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
};

export default function Rooms() {
  const roomsQuery = useRoomsQuery();
  const createMutation = useCreateRoomMutation();
  const updateMutation = useUpdateRoomMutation();
  const deleteMutation = useDeleteRoomMutation();
  const uploadBulkMutation = useUploadRoomsBulkMutation();
  const downloadTemplateMutation = useDownloadRoomsTemplateMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  if (roomsQuery.isLoading) {
    return (
      <AppLayout title="Rooms" subtitle="Define exam rooms, capacities, and minimum invigilator requirements.">
        <LoadingState title="Loading rooms..." description="Fetching room inventory from the backend." />
      </AppLayout>
    );
  }

  if (roomsQuery.isError) {
    return (
      <AppLayout title="Rooms" subtitle="Define exam rooms, capacities, and minimum invigilator requirements.">
        <ErrorState description={getErrorMessage(roomsQuery.error)} onRetry={() => void roomsQuery.refetch()} />
      </AppLayout>
    );
  }

  const rooms = roomsQuery.data?.items ?? [];

  async function handleSubmit(payload: RoomRequest) {
    try {
      if (editingRoom) {
        await updateMutation.mutateAsync({ id: editingRoom.id, payload });
        toast.success("Room updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Room created.");
      }

      setDialogOpen(false);
      setEditingRoom(null);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Room deleted.");
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <AppLayout
      title="Rooms"
      subtitle="Define exam rooms, capacities, and minimum invigilator requirements."
      actions={
        <RoomDialog
          key={editingRoom?.id ?? "new-room"}
          open={dialogOpen}
          title={editingRoom ? "Edit room" : "Add room"}
          initialValue={editingRoom}
          trigger={
            <Button
              className="gap-2"
              onClick={() => {
                setEditingRoom(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add room
            </Button>
          }
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) {
              setEditingRoom(null);
            }
          }}
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      }
    >
      <div className="space-y-6">
        <BulkUploadCard
          kind="rooms"
          existingNames={rooms.map((room) => room.name)}
          isUploading={uploadBulkMutation.isPending}
          onDownloadTemplate={() => downloadTemplateMutation.mutateAsync()}
          onUpload={({ file, duplicateStrategy }) => uploadBulkMutation.mutateAsync({ file, duplicateStrategy })}
        />

        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms configured"
            description="Create the first room to start assigning exam coverage."
            action={<Button onClick={() => setDialogOpen(true)}>Create room</Button>}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium">Room</th>
                  <th className="px-3 py-3 font-medium">Capacity</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Staffing guideline</th>
                  <th className="px-3 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-border hover:bg-accent/20 transition-smooth">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                          <DoorOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{room.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{room.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{room.capacity} seats</td>
                    <td className="px-3 py-3">
                      <Badge className={cn("border", ROOM_TYPE_BADGES[room.type])}>{ROOM_TYPE_LABELS[room.type]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      1 Chief Invigilator + {room.minInvigilators} Invigilator{room.minInvigilators > 1 ? "s" : ""}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingRoom(room); setDialogOpen(true); }}>
                          <PencilLine className="h-4 w-4" /> Edit
                        </Button>
                        <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(room.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
            <Label>Room type</Label>
            <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.type} onChange={(event) => setFormState((previous) => ({ ...previous, type: event.target.value as RoomType }))}>
              {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
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
