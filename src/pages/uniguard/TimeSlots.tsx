import { Clock3, Layers, MoreHorizontal, PencilLine, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { TimeSlot, TimeSlotRequest } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/uniguard/AppLayout";
import {
  useActivateTimeSlotMutation,
  useCreateTimeSlotMutation,
  useDeactivateTimeSlotMutation,
  useDeleteTimeSlotMutation,
  useTimeSlotsQuery,
  useUpdateTimeSlotMutation,
} from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { byStartTime, dayRange, durationLabel, hhmm, minutesOf, overlapping } from "@/lib/timeSlots";
import { cn } from "@/lib/utils";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const TITLE = "Time Slots";
const SUBTITLE = "Exam sessions shared by every exam period, like people and rooms.";

type Pending = { kind: "deactivate" | "delete"; slot: TimeSlot } | null;

export default function TimeSlotsPage() {
  const { canEdit } = usePermissions();
  const timeSlotsQuery = useTimeSlotsQuery();
  const createMutation = useCreateTimeSlotMutation();
  const updateMutation = useUpdateTimeSlotMutation();
  const deactivateMutation = useDeactivateTimeSlotMutation();
  const activateMutation = useActivateTimeSlotMutation();
  const deleteMutation = useDeleteTimeSlotMutation();
  const [dialog, setDialog] = useState<{ open: boolean; slot: TimeSlot | null }>({ open: false, slot: null });
  const [pending, setPending] = useState<Pending>(null);

  const all = useMemo(() => [...(timeSlotsQuery.data?.items ?? [])].sort(byStartTime), [timeSlotsQuery.data]);
  const active = useMemo(() => all.filter((slot) => slot.active), [all]);
  const inactive = useMemo(() => all.filter((slot) => !slot.active), [all]);

  if (timeSlotsQuery.isPending) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading time slots..." description="Fetching slot templates from the backend." />
      </AppLayout>
    );
  }

  if (timeSlotsQuery.isError) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(timeSlotsQuery.error)} onRetry={() => void timeSlotsQuery.refetch()} />
      </AppLayout>
    );
  }

  async function handleSubmit(payload: TimeSlotRequest) {
    try {
      if (dialog.slot) {
        await updateMutation.mutateAsync({ id: dialog.slot.id, payload });
        toast.success("Time slot updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Time slot added.");
      }
      setDialog({ open: false, slot: null });
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function activate(slot: TimeSlot) {
    try {
      await activateMutation.mutateAsync(slot.id);
      toast.success(`${slot.label || "Time slot"} is active again.`);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    try {
      if (pending.kind === "delete") {
        await deleteMutation.mutateAsync(pending.slot.id);
        toast.success("Time slot deleted.");
      } else {
        await deactivateMutation.mutateAsync(pending.slot.id);
        toast.success("Time slot deactivated.");
      }
      setPending(null);
    } catch (error) {
      showErrorToast(error, { title: pending.kind === "delete" ? "Could not delete the time slot." : "Could not deactivate the time slot." });
    }
  }

  const nextSortOrder = Math.max(0, ...all.map((slot) => slot.sortOrder)) + 1;

  return (
    <AppLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={canEdit && <Button className="gap-2" onClick={() => setDialog({ open: true, slot: null })}><Plus className="h-4 w-4" /> Add time slot</Button>}
    >
      <TooltipProvider delayDuration={150}>
        {all.length === 0 ? (
          <EmptyState
            title="No time slots yet"
            description="Add the exam sessions of a day, for example Morning 09:00 – 12:00."
            action={canEdit && <Button onClick={() => setDialog({ open: true, slot: null })}>Add time slot</Button>}
          />
        ) : (
          <div className="space-y-5">
            {active.length > 0 && <DayBar slots={active} onPick={canEdit ? (slot) => setDialog({ open: true, slot }) : undefined} />}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <header className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Active <span className="font-normal text-muted-foreground">· {active.length}</span></h2>
                <span className="text-xs text-muted-foreground">In time order</span>
              </header>
              {active.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No active time slots. Activate one below or add a new one.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {active.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      overlaps={overlapping(slot, active)}
                      canEdit={canEdit}
                      onEdit={() => setDialog({ open: true, slot })}
                      onDeactivate={() => setPending({ kind: "deactivate", slot })}
                      onDelete={() => setPending({ kind: "delete", slot })}
                    />
                  ))}
                </ul>
              )}
            </section>

            {inactive.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-dashed border-border bg-card/60">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Inactive <span className="font-normal">· {inactive.length}</span></h2>
                  <p className="text-xs text-muted-foreground">Kept for the exams that already use them; not offered for new scheduling.</p>
                </header>
                <ul className="divide-y divide-border">
                  {inactive.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      overlaps={[]}
                      canEdit={canEdit}
                      onEdit={() => setDialog({ open: true, slot })}
                      onActivate={() => void activate(slot)}
                      onDelete={() => setPending({ kind: "delete", slot })}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </TooltipProvider>

      <TimeSlotDialog
        open={dialog.open}
        slot={dialog.slot}
        others={all}
        nextSortOrder={nextSortOrder}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => setDialog((previous) => ({ ...previous, open }))}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "delete" ? "Delete" : "Deactivate"} {pending?.slot.label || "this time slot"} ({pending && `${hhmm(pending.slot.startTime)} – ${hhmm(pending.slot.endTime)}`})?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "delete"
                ? "It is removed for every exam period. The server refuses if any exam still uses it; deactivate it instead."
                : "It is no longer offered for new scheduling in any exam period. Exams that already use it stay as they are, and you can activate it again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pending?.kind === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              disabled={deleteMutation.isPending || deactivateMutation.isPending}
              onClick={(event) => { event.preventDefault(); void confirmPending(); }}
            >
              {pending?.kind === "delete" ? "Delete" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

const BAR_COLORS = ["bg-primary", "bg-chief", "bg-invigilator", "bg-warning", "bg-shared", "bg-success"];

/** The shape of an exam day: every active slot as a block on one hour scale; overlapping slots get their own lane. */
function DayBar({ slots, onPick }: { slots: TimeSlot[]; onPick?: (slot: TimeSlot) => void }) {
  const { from, to } = dayRange(slots);
  const span = to - from;
  const lanes: TimeSlot[][] = [];
  for (const slot of slots) {
    const lane = lanes.find((candidate) => minutesOf(candidate[candidate.length - 1].endTime) <= minutesOf(slot.startTime));
    if (lane) lane.push(slot);
    else lanes.push([slot]);
  }
  const hours = Array.from({ length: span / 60 + 1 }, (_, index) => from + index * 60);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label="The exam day">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">The exam day</h2>
        <span className="text-xs text-muted-foreground">{lanes.length > 1 ? "Overlapping slots are shown on separate lines" : "No overlapping slots"}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="relative mb-1 h-4 text-[10px] text-muted-foreground">
            {hours.map((minute) => (
              <span key={minute} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${((minute - from) / span) * 100}%` }}>
                {String(minute / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div className="relative space-y-1.5 rounded-lg bg-muted/40 p-1.5">
            {hours.map((minute) => (
              <span key={minute} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${((minute - from) / span) * 100}%` }} />
            ))}
            {lanes.map((lane, laneIndex) => (
              <div key={laneIndex} className="relative h-9">
                {lane.map((slot) => {
                  const color = BAR_COLORS[slots.indexOf(slot) % BAR_COLORS.length];
                  const left = ((minutesOf(slot.startTime) - from) / span) * 100;
                  const width = ((minutesOf(slot.endTime) - minutesOf(slot.startTime)) / span) * 100;
                  return (
                    <Tooltip key={slot.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={!onPick}
                          onClick={() => onPick?.(slot)}
                          className={cn("absolute inset-y-0 overflow-hidden rounded-md px-2 text-left text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-default", color)}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="block truncate leading-9">{slot.label || `${hhmm(slot.startTime)}–${hhmm(slot.endTime)}`}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{slot.label ? `${slot.label} · ` : ""}{hhmm(slot.startTime)} – {hhmm(slot.endTime)} ({durationLabel(slot.startTime, slot.endTime)})</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SlotRow({ slot, overlaps, canEdit, onEdit, onDeactivate, onActivate, onDelete }: {
  slot: TimeSlot;
  overlaps: TimeSlot[];
  canEdit: boolean;
  onEdit: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-4 px-5 py-3", !slot.active && "opacity-70")}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", slot.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        <Clock3 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-base font-semibold tabular-nums">{hhmm(slot.startTime)} – {hhmm(slot.endTime)}</span>
          <span className="text-sm font-medium">{slot.label || <span className="text-muted-foreground">No name</span>}</span>
          <span className="text-xs text-muted-foreground">{durationLabel(slot.startTime, slot.endTime)}</span>
        </div>
        {overlaps.length > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="h-3 w-3" /> Overlaps {overlaps.map((other) => other.label || `${hhmm(other.startTime)}–${hhmm(other.endTime)}`).join(", ")}
          </p>
        )}
      </div>
      {!slot.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Inactive</span>}
      {canEdit && (
        <>
          {onActivate && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onActivate}><Power className="h-4 w-4" /> Activate</Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${slot.label || hhmm(slot.startTime)}`}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><PencilLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              {onDeactivate && <DropdownMenuItem onSelect={onDeactivate}><PowerOff className="mr-2 h-4 w-4" /> Deactivate</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );
}

function TimeSlotDialog({ open, slot, others, nextSortOrder, isSubmitting, onOpenChange, onSubmit }: {
  open: boolean;
  slot: TimeSlot | null;
  others: TimeSlot[];
  nextSortOrder: number;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TimeSlotRequest) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");

  useEffect(() => {
    if (!open) return;
    setLabel(slot?.label ?? "");
    setStart(slot ? hhmm(slot.startTime) : "09:00");
    setEnd(slot ? hhmm(slot.endTime) : "11:00");
  }, [open, slot]);

  const validTimes = Boolean(start && end) && minutesOf(end) > minutesOf(start);
  const same = others.find((other) => other.id !== slot?.id && hhmm(other.startTime) === start && hhmm(other.endTime) === end);
  const overlaps = validTimes ? overlapping({ id: slot?.id ?? "new", label, startTime: start, endTime: end }, others.filter((other) => other.active)) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slot ? "Edit time slot" : "Add time slot"}</DialogTitle>
          <DialogDescription>Shared by every exam period. Several exams can run in the same slot, in different rooms.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validTimes || isSubmitting) return;
            void onSubmit({ label: label.trim() || undefined, startTime: `${start}:00`, endTime: `${end}:00`, sortOrder: slot?.sortOrder ?? nextSortOrder });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="slot-label">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="slot-label" value={label} maxLength={120} placeholder="Morning" onChange={(event) => setLabel(event.target.value)} autoFocus={!slot} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slot-start">Starts</Label>
              <Input id="slot-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot-end">Ends</Label>
              <Input id="slot-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} aria-invalid={!validTimes} required />
            </div>
          </div>
          {!validTimes ? (
            <p className="text-xs text-destructive">The end must be after the start.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {durationLabel(start, end)}
              {overlaps.length > 0 && ` · overlaps ${overlaps.map((other) => other.label || `${hhmm(other.startTime)}–${hhmm(other.endTime)}`).join(", ")}`}
            </p>
          )}
          {same && <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">“{same.label || "Another slot"}” already has exactly these times.</p>}
          {slot && <p className="text-xs text-muted-foreground">Changing the times re-checks every exam in this slot; the server refuses changes that would create clashes.</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!validTimes || isSubmitting}>{isSubmitting ? "Saving..." : slot ? "Save changes" : "Add time slot"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
