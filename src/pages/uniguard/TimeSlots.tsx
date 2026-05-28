import { Clock3, PencilLine, Plus, Power, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { TimeSlot, TimeSlotRequest } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/uniguard/AppLayout";
import {
    useCreateTimeSlotMutation,
    useDeactivateTimeSlotMutation,
    useDeleteTimeSlotMutation,
    useTimeSlotsQuery,
    useUpdateTimeSlotMutation,
} from "@/hooks";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { toast } from "sonner";

const DEFAULT_TIME_SLOT_FORM: TimeSlotRequest = {
  label: "Morning Session",
  startTime: "08:00:00",
  endTime: "11:00:00",
  sortOrder: 1,
};

function normalizeTimeValue(value: string): string {
  if (value.length === 5) {
    return `${value}:00`;
  }

  return value;
}

export default function TimeSlotsPage() {
  const timeSlotsQuery = useTimeSlotsQuery();
  const createMutation = useCreateTimeSlotMutation();
  const updateMutation = useUpdateTimeSlotMutation();
  const deactivateMutation = useDeactivateTimeSlotMutation();
  const deleteMutation = useDeleteTimeSlotMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);

  if (timeSlotsQuery.isLoading) {
    return (
      <AppLayout title="Time Slots" subtitle="Configure the reusable exam sessions available for assignments.">
        <LoadingState title="Loading time slots..." description="Fetching slot templates from the backend." />
      </AppLayout>
    );
  }

  if (timeSlotsQuery.isError) {
    return (
      <AppLayout title="Time Slots" subtitle="Configure the reusable exam sessions available for assignments.">
        <ErrorState description={getErrorMessage(timeSlotsQuery.error)} onRetry={() => void timeSlotsQuery.refetch()} />
      </AppLayout>
    );
  }

  const timeSlots = timeSlotsQuery.data?.items ?? [];

  async function handleSubmit(payload: TimeSlotRequest) {
    try {
      if (editingSlot) {
        await updateMutation.mutateAsync({ id: editingSlot.id, payload });
        toast.success("Time slot updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Time slot created.");
      }

      setDialogOpen(false);
      setEditingSlot(null);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateMutation.mutateAsync(id);
      toast.success("Time slot deactivated.");
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Time slot deleted.");
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <AppLayout
      title="Time Slots"
      subtitle="Configure the reusable exam sessions available for assignments."
      actions={
        <TimeSlotDialog
          key={editingSlot?.id ?? "new-slot"}
          open={dialogOpen}
          title={editingSlot ? "Edit time slot" : "Add time slot"}
          initialValue={editingSlot}
          trigger={
            <Button
              className="gap-2"
              onClick={() => {
                setEditingSlot(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add time slot
            </Button>
          }
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) {
              setEditingSlot(null);
            }
          }}
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      }
    >
      {timeSlots.length === 0 ? (
        <EmptyState
          title="No time slots configured"
          description="Create the first slot before assigning rooms to dates."
          action={<Button onClick={() => setDialogOpen(true)}>Create time slot</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {timeSlots.map((timeSlot) => (
            <div key={timeSlot.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{timeSlot.label}</div>
                  <div className="text-xs text-muted-foreground">Sort order {timeSlot.sortOrder}</div>
                </div>
                <Badge variant={timeSlot.active ? "default" : "secondary"}>{timeSlot.active ? "Active" : "Inactive"}</Badge>
              </div>

              <div className="mt-4 rounded-lg bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Time window</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {timeSlot.startTime} - {timeSlot.endTime}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingSlot(timeSlot); setDialogOpen(true); }}>
                  <PencilLine className="h-4 w-4" /> Edit
                </Button>
                {timeSlot.active ? (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDeactivate(timeSlot.id)}>
                    <Power className="h-4 w-4" /> Deactivate
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(timeSlot.id)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function TimeSlotDialog({
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
  initialValue: TimeSlot | null;
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TimeSlotRequest) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [formState, setFormState] = useState<TimeSlotRequest>(DEFAULT_TIME_SLOT_FORM);

  useEffect(() => {
    setFormState(
      initialValue
        ? {
            label: initialValue.label,
            startTime: initialValue.startTime,
            endTime: initialValue.endTime,
            sortOrder: initialValue.sortOrder,
          }
        : DEFAULT_TIME_SLOT_FORM,
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
            <Label>Slot label</Label>
            <Input value={formState.label ?? ""} onChange={(event) => setFormState((previous) => ({ ...previous, label: event.target.value }))} placeholder="Morning Session" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start time</Label>
              <Input type="time" step={1} value={formState.startTime} onChange={(event) => setFormState((previous) => ({ ...previous, startTime: normalizeTimeValue(event.target.value) }))} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" step={1} value={formState.endTime} onChange={(event) => setFormState((previous) => ({ ...previous, endTime: normalizeTimeValue(event.target.value) }))} />
            </div>
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" min={0} value={formState.sortOrder ?? 0} onChange={(event) => setFormState((previous) => ({ ...previous, sortOrder: Number(event.target.value) || 0 }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isSubmitting || !formState.startTime || !formState.endTime} onClick={() => void onSubmit({
            ...formState,
            label: formState.label?.trim() || undefined,
            startTime: normalizeTimeValue(formState.startTime),
            endTime: normalizeTimeValue(formState.endTime),
          })}>
            {isSubmitting ? "Saving..." : "Save time slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}