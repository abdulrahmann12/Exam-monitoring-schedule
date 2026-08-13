import { useMemo, useState } from "react";
import { useUniGuard } from "@/lib/uniguard/store";
import { Lock, Unlock, AlertTriangle, Users, GripVertical, Plus, Trash2, RotateCcw, Undo2, CheckCircle2, Clock3, BookOpen, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { overlappingAssignmentsForSlot } from "@/lib/uniguard/constraintEngine";
import { AssignmentState, dayOfDate, roleLabelAr } from "@/lib/uniguard/types";
import { StaffPicker } from "./StaffPicker";
import { StaffProfileDialog } from "./StaffProfileDialog";
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  date: string;
  slotId: string;
}

export function ScheduleGrid({ date, slotId }: Props) {
  const { getEntry, rooms, staff, slots, schedule, manualAssign, toggleLock, swapInvigilators, addInvigilatorSlot, removeInvigilatorSlot, undoLastChange, resetSlotToGenerated, validateEntry, validateOne, updateAssignmentSubject, addRoomToSlot } = useUniGuard();
  const entry = getEntry(date, slotId);
  const slot = slots.find((s) => s.id === slotId);
  const day = dayOfDate(date);
  const [profileId, setProfileId] = useState<string | null>(null);
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const usedRoomIds = useMemo(() => new Set(entry?.assignments.map((a) => a.roomId) ?? []), [entry]);
  const availableRooms = useMemo(() => rooms.filter((r) => !usedRoomIds.has(r.id)), [rooms, usedRoomIds]);
  const avgLoad = useMemo(() => staff.reduce((sum, person) => sum + person.totalAssignments, 0) / Math.max(1, staff.length), [staff]);
  const pickerAssignments = useMemo(
    () => overlappingAssignmentsForSlot(schedule.filter((item) => item.date === date).flatMap((item) => item.assignments), slots, slotId),
    [date, schedule, slotId, slots],
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const from = e.active.id as string;
    const to = e.over?.id as string | undefined;
    if (!to || from === to) return;
    const [fr, fi] = from.split("|");
    const [tr, ti] = to.split("|");
    swapInvigilators(date, slotId, fr, parseInt(fi), tr, parseInt(ti));
    toast.success("Invigilators swapped successfully");
  };

  if (!entry) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-display text-lg font-semibold">No schedule generated yet</h3>
        <p className="text-sm text-muted-foreground mt-1">Pick rooms and click <span className="font-medium text-foreground">Generate schedule</span> to build this time slot.</p>
      </div>
    );
  }

  const validation = validateEntry(entry);

  const assign = (roomId: string, kind: "chief" | "invigilator", index: number, staffId: string | null) => {
    const result = manualAssign(date, slotId, roomId, kind, index, staffId);
    if (result.ok) toast.success(staffId ? "Assignment updated" : "Assignment cleared");
    else toast.error(result.message ?? "Assignment blocked by constraints");
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-3.5 border-b border-border bg-muted/30 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-display font-semibold">{slot ? `${slot.startTime} – ${slot.endTime}` : slotId}</h3>
            <Badge variant="outline" className="font-mono text-xs">{day}</Badge>
            <Badge variant="outline" className="text-xs">{entry.assignments.length} rooms</Badge>
            <StateBadge state={validation.state} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {availableRooms.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add room</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2 bg-popover">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">Add another exam to this slot</div>
                  <div className="max-h-64 overflow-y-auto">
                    {availableRooms.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { addRoomToSlot(date, slotId, r.id); toast.success(`${r.name} added to this slot`); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-smooth text-left text-sm"
                      >
                        <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground">cap {r.capacity}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { const ok = undoLastChange(); toast[ok ? "success" : "error"](ok ? "Last change undone" : "Nothing to undo"); }}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { const ok = resetSlotToGenerated(date, slotId); toast[ok ? "success" : "error"](ok ? "Slot reset to last generated version" : "No generated baseline for this slot"); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset slot
            </Button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {entry.assignments.map((assignment) => {
            const room = rooms.find((r) => r.id === assignment.roomId);
            if (!room) return null;
            const chief = assignment.chiefInvigilatorId ? staffMap.get(assignment.chiefInvigilatorId) : null;
            const assignmentValidation = validateOne(entry, assignment);
            return (
              <section key={assignment.roomId} className={cn("p-4 transition-smooth", stateSurface(assignmentValidation.state), assignment.locked && "bg-warning/5")}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                  <div className="xl:w-56 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{room.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Cap. {room.capacity} · Min {room.minInvigilators} invigilator{room.minInvigilators > 1 ? "s" : ""}</div>
                      </div>
                      <StateBadge state={assignmentValidation.state} compact />
                    </div>
                    <SubjectEditor
                      name={assignment.subjectName ?? slot?.subjectName ?? ""}
                      code={assignment.subjectCode ?? slot?.subjectCode ?? ""}
                      onSave={(name, code) => { updateAssignmentSubject(date, slotId, assignment.roomId, { subjectName: name, subjectCode: code }); toast.success("Subject updated"); }}
                    />
                    {assignmentValidation.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {assignmentValidation.issues.slice(0, 2).map((issue, i) => <div key={i} className="text-[11px] text-muted-foreground flex gap-1"><AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />{issue.message}</div>)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr] gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Chief Invigilator <span className="font-normal">({roleLabelAr("CHIEF_INVIGILATOR")})</span></div>
                      <StaffCell
                        person={chief ?? null}
                        tone="chief"
                        shared={!!assignment.sharedChief}
                        avgLoad={avgLoad}
                        missing={!chief}
                        onProfile={() => chief && setProfileId(chief.id)}
                        picker={<StaffPicker role="CHIEF_INVIGILATOR" day={day} staff={staff} slotAssignments={pickerAssignments} currentId={assignment.chiefInvigilatorId} onPick={(id) => assign(assignment.roomId, "chief", 0, id)} trigger={<button className="absolute inset-0" aria-label="Assign Chief Invigilator" />} />}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Invigilators <span className="font-normal">({roleLabelAr("INVIGILATOR")})</span></div>
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => { addInvigilatorSlot(date, slotId, assignment.roomId); toast.success("Invigilator slot added"); }}>
                          <Plus className="h-3 w-3" /> Add Invigilator
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {assignment.invigilatorIds.map((id, index) => {
                          const person = id ? staffMap.get(id) : null;
                          const belowMinAfterRemove = assignment.invigilatorIds.length - 1 < room.minInvigilators;
                          return (
                            <DroppableInvigilator key={index} roomId={assignment.roomId} idx={index}>
                              <DraggableInvigilator roomId={assignment.roomId} idx={index} disabled={!person}>
                                <StaffCell
                                  person={person ?? null}
                                  tone="invigilator"
                                  avgLoad={avgLoad}
                                  missing={!person && index < room.minInvigilators}
                                  onProfile={() => person && setProfileId(person.id)}
                                  picker={<StaffPicker role="INVIGILATOR" day={day} staff={staff} slotAssignments={pickerAssignments} currentId={id} onPick={(picked) => assign(assignment.roomId, "invigilator", index, picked)} trigger={<button className="absolute inset-0" aria-label="Assign Invigilator" />} />}
                                  leading={person ? <GripVertical className="h-3.5 w-3.5 text-invigilator/50 shrink-0" /> : null}
                                  trailing={
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeInvigilatorSlot(date, slotId, assignment.roomId, index); toast.warning(belowMinAfterRemove ? "Below minimum invigilator count" : "Invigilator slot removed"); }}
                                      className="relative z-10 text-muted-foreground hover:text-destructive"
                                      title={belowMinAfterRemove ? "Removing this will fall below minimum" : "Remove slot"}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  }
                                />
                              </DraggableInvigilator>
                            </DroppableInvigilator>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex xl:flex-col gap-2 xl:w-28 shrink-0 xl:items-end">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                      assign(assignment.roomId, "chief", 0, null);
                      assignment.invigilatorIds.forEach((_, i) => assign(assignment.roomId, "invigilator", i, null));
                    }}>
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </Button>
                    <Button variant="outline" size="sm" className={cn("gap-1.5", assignment.locked && "border-warning text-warning")} onClick={() => toggleLock(date, slotId, assignment.roomId)}>
                      {assignment.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}{assignment.locked ? "Locked" : "Open"}
                    </Button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <StaffProfileDialog staffId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </DndContext>
  );
}

function StaffCell({ person, tone, shared, avgLoad, missing, picker, onProfile, leading, trailing }: { person: any; tone: "chief" | "invigilator"; shared?: boolean; avgLoad: number; missing?: boolean; picker: React.ReactNode; onProfile: () => void; leading?: React.ReactNode; trailing?: React.ReactNode }) {
  const overAssigned = person && person.totalAssignments > Math.max(2, Math.ceil(avgLoad * 1.5));
  return (
    <div className={cn("relative group flex items-center gap-2 rounded-lg px-2.5 py-2 min-h-12 border transition-smooth", tone === "chief" ? "bg-chief-soft hover:bg-chief-soft/80" : "bg-invigilator-soft hover:bg-invigilator-soft/80", missing && "bg-destructive/5 border-dashed border-destructive/40")}>
      {picker}{leading}
      <div className={cn("h-8 w-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0", person ? (tone === "chief" ? "bg-chief text-chief-foreground" : "bg-invigilator text-invigilator-foreground") : "bg-destructive text-destructive-foreground")}>{person ? initials(person.name) : "!"}</div>
      <button onClick={(e) => { e.stopPropagation(); onProfile(); }} className="relative z-10 min-w-0 flex-1 text-left">
        <div className="text-xs font-medium truncate">{person?.name ?? "Assign staff"}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {shared && <Badge className="bg-shared-soft text-shared border-shared/20 text-[9px] py-0 px-1 h-3.5">Shared</Badge>}
          {person && <span className={cn("text-[10px]", overAssigned ? "text-warning font-semibold" : "text-muted-foreground")}>{person.totalAssignments}× {overAssigned && "⚠"}</span>}
        </div>
      </button>
      <div className="relative z-10 shrink-0">{trailing}</div>
    </div>
  );
}

function StateBadge({ state, compact }: { state: AssignmentState; compact?: boolean }) {
  const map = {
    VALID: { icon: CheckCircle2, label: "Valid", cls: "bg-success/10 text-success border-success/20" },
    INCOMPLETE: { icon: Clock3, label: "Incomplete", cls: "bg-warning/10 text-warning border-warning/20" },
    CONFLICT: { icon: AlertTriangle, label: "Conflict", cls: "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" },
  }[state];
  const Icon = map.icon;
  return <Badge className={cn(map.cls, "hover:bg-transparent", compact && "text-[10px]")}><Icon className="h-3 w-3 mr-1" />{map.label}</Badge>;
}

function stateSurface(state: AssignmentState) {
  if (state === "VALID") return "border-l-4 border-l-success";
  if (state === "INCOMPLETE") return "border-l-4 border-l-warning";
  return "border-l-4 border-l-destructive bg-destructive/5";
}

function DraggableInvigilator({ roomId, idx, disabled, children }: { roomId: string; idx: number; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${roomId}|${idx}`, disabled });
  return <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-40")}>{children}</div>;
}

function DroppableInvigilator({ roomId, idx, children }: { roomId: string; idx: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${roomId}|${idx}` });
  return <div ref={setNodeRef} className={cn("rounded-lg transition-smooth", isOver && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>{children}</div>;
}

function initials(name: string) {
  return name.replace(/^Dr\.\s*/, "").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

function SubjectEditor({ name, code, onSave }: { name: string; code: string; onSave: (name: string, code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [c, setC] = useState(code);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setN(name); setC(code); } }}>
      <PopoverTrigger asChild>
        <button className="mt-2 w-full text-left rounded-md border border-border bg-muted/40 hover:bg-muted/60 transition-smooth px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <BookOpen className="h-3 w-3" /> Subject
          </div>
          <div className="text-xs font-medium truncate">{name || <span className="text-muted-foreground italic">Click to set subject</span>}</div>
          {code && <div className="text-[10px] text-muted-foreground font-mono">{code}</div>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-popover" align="start">
        <div className="space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Subject name</label>
            <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="e.g. Algorithms" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Subject code</label>
            <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="e.g. CS301" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { onSave(n.trim(), c.trim()); setOpen(false); }}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
