import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { BulkScheduleUploadModal } from "@/components/uniguard/BulkScheduleUploadModal";
import { ExportDialog } from "@/components/uniguard/ExportDialog";
import { ScheduleGrid } from "@/components/uniguard/ScheduleGrid";
import { useUniGuard } from "@/lib/uniguard/store";
import { dayOfDate } from "@/lib/uniguard/types";
import { useUnsavedChangesGuard } from "@/lib/unsavedChanges";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage } from "@/utils/error";
import { format, parseISO } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Clock3, DoorOpen, FileDown, FileSpreadsheet, LoaderCircle, RotateCw, Save, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const TITLE = "Scheduler";
/** Up to this many time slots show as tabs; more become one dropdown with previous / next arrows. */
const TABS_MAX = 4;
/** The room list gets a search box from this many rooms on. */
const ROOM_SEARCH_FROM = 8;
const SUBTITLE = "Allocate chiefs and invigilators for the selected exam period.";

export default function Scheduler() {
  const { rooms, slots, schedule, generate, getEntry, validateEntry, isLoading, error, isPersisting, isGenerating, isEntryDirty, dirtyEntries, saveEntry } = useUniGuard();
  const { activeGroupId, activeGroup } = useScheduleGroup();
  // Opened from the Timeline: /scheduler?date=2026-11-17&slot=<id> starts on that exam.
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState<Date>(() => {
    const requested = searchParams.get("date");
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? parseISO(requested) : new Date();
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [slotId, setSlotId] = useState(() => searchParams.get("slot") ?? "");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");

  useEffect(() => {
    // Wait for the slots to load: clearing the choice while the list is still empty would lose
    // a slot asked for in the address (/scheduler?date=…&slot=… from the Timeline).
    if (slots.length === 0) {
      return;
    }

    if (!slotId || !slots.some((slot) => slot.id === slotId)) {
      setSlotId(slots[0].id);
    }
  }, [slotId, slots]);

  const hasSchedulerPrerequisites = rooms.length > 0 && slots.length > 0;
  const activeSlotId = slots.find((candidate) => candidate.id === slotId)?.id ?? slots[0]?.id ?? "";
  const dateStr = format(date, "yyyy-MM-dd");
  const day = dayOfDate(dateStr);
  const entry = hasSchedulerPrerequisites && activeSlotId ? getEntry(dateStr, activeSlotId) : undefined;
  const entryDirty = hasSchedulerPrerequisites && activeSlotId ? isEntryDirty(dateStr, activeSlotId) : false;
  const otherDirty = dirtyEntries.filter((item) => !(item.date === dateStr && item.slotId === activeSlotId));
  const entryRoomIds = entry?.assignments.map((assignment) => assignment.roomId).join("::") ?? "";
  const entrySelection = useMemo(
    () => (entryRoomIds
      ? entryRoomIds.split("::").filter((roomId, index, roomIds) => roomIds.indexOf(roomId) === index && rooms.some((room) => room.id === roomId))
      : []),
    [entryRoomIds, rooms],
  );

  // Days with exams (dot on the calendar) and days with unsaved changes (amber dot).
  const calendarMarks = useMemo(() => {
    const unsaved = new Set(dirtyEntries.map((item) => item.date));
    const scheduled = new Set(schedule.filter((item) => item.assignments.length > 0).map((item) => item.date));
    return {
      scheduled: [...scheduled].filter((value) => !unsaved.has(value)).map((value) => parseISO(value)),
      unsaved: [...unsaved].map((value) => parseISO(value)),
    };
  }, [dirtyEntries, schedule]);

  useUnsavedChangesGuard(
    dirtyEntries.length > 0
      ? `You have unsaved changes in ${dirtyEntries.length} time slot${dirtyEntries.length === 1 ? "" : "s"}. Leave and lose them?`
      : null,
  );

  const handleSave = useCallback(async () => {
    if (!activeSlotId) {
      return;
    }

    const saved = await saveEntry(dateStr, activeSlotId);
    if (saved) {
      toast.success("Schedule saved.");
    }
  }, [activeSlotId, dateStr, saveEntry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();

      if (event.repeat || !entry || !entryDirty || isPersisting) {
        return;
      }

      void handleSave();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [entry, entryDirty, handleSave, isPersisting]);

  useEffect(() => {
    setSelectedRooms((previous) => {
      if (entrySelection.length > 0) {
        const unchanged = entrySelection.length === previous.length && entrySelection.every((roomId, index) => roomId === previous[index]);

        return unchanged ? previous : entrySelection;
      }

      const valid = previous.filter((roomId) => rooms.some((room) => room.id === roomId));

      if (valid.length > 0 || rooms.length === 0) {
        return valid;
      }

      return rooms.filter((room) => room.active !== false).slice(0, 5).map((room) => room.id);
    });
  }, [activeSlotId, dateStr, entrySelection, rooms]);

  if (isLoading) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading scheduler..." description="Fetching people, rooms, time slots, and saved assignments." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(error)} />
      </AppLayout>
    );
  }

  if (rooms.length === 0 || slots.length === 0) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <EmptyState
          title="Scheduler prerequisites missing"
          description={rooms.length === 0 ? "Add at least one room before generating a schedule." : "Add at least one time slot before generating a schedule."}
        />
      </AppLayout>
    );
  }

  const toggleRoom = (id: string) => setSelectedRooms((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const onAssign = async (partial: boolean) => {
    if (selectedRooms.length === 0) return toast.error("Select at least one room first");
    const { ok, conflicts } = await generate({ date: dateStr, slotId: activeSlotId, roomIds: selectedRooms, partial });
    if (!ok) return;
    if (conflicts.length === 0) toast.success(partial ? "Schedule regenerated" : "Schedule generated", { description: `${selectedRooms.length} rooms ready to review and save. Locked rooms were kept.` });
    else toast.warning(`${conflicts.length} issues detected`, { description: conflicts.slice(0, 3).join(" ") });
  };

  // Slots in time order; status per slot for the chosen day.
  const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const activeSlotIndex = sortedSlots.findIndex((candidate) => candidate.id === activeSlotId);
  const activeSlot = sortedSlots[activeSlotIndex];
  const slotStatus = (id: string) => {
    const slotEntry = getEntry(dateStr, id);
    return {
      dirty: isEntryDirty(dateStr, id),
      state: slotEntry && slotEntry.assignments.length > 0 ? validateEntry(slotEntry).state : null,
      rooms: slotEntry?.assignments.length ?? 0,
    };
  };
  const roomNeedle = roomSearch.trim().toLowerCase();
  // Out-of-service rooms are not offered, but stay visible where this exam already uses them.
  const offeredRooms = rooms.filter((room) => room.active !== false || selectedRooms.includes(room.id));
  const visibleRooms = roomNeedle ? offeredRooms.filter((room) => room.name.toLowerCase().includes(roomNeedle)) : offeredRooms;

  const jumpTo = (target: { date: string; slotId: string }) => {
    setDate(parseISO(target.date));
    setSlotId(target.slotId);
  };

  return (
    <AppLayout
      title={TITLE}
      subtitle={activeGroup ? `${activeGroup.name} · allocate chiefs and invigilators for each exam slot.` : SUBTITLE}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" disabled={!activeGroupId} onClick={() => setBulkUploadOpen(true)}><FileSpreadsheet className="h-4 w-4" /> Bulk schedule</Button>
          <Button variant="outline" className="gap-2" onClick={() => setExportOpen(true)}><FileDown className="h-4 w-4" /> Export PDF</Button>
        </div>
      }
    >
      <div className="space-y-5 pb-20">
        {/* One toolbar instead of three step cards: when → which rooms → generate. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card xl:flex-row xl:flex-wrap xl:items-center">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 justify-start gap-2 font-normal xl:w-60">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{format(date, "EEE d MMM yyyy")}</span>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(picked) => { if (picked) { setDate(picked); setCalendarOpen(false); } }}
                modifiers={calendarMarks}
                modifiersClassNames={{
                  scheduled: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  unsaved: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-warning",
                }}
                initialFocus
                className="pointer-events-auto p-3"
              />
              <div className="flex gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Has exams</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved</span>
              </div>
            </PopoverContent>
          </Popover>

          {sortedSlots.length <= TABS_MAX ? (
            <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Time slot">
              {sortedSlots.map((slot) => {
                const active = slot.id === activeSlotId;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSlotId(slot.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors",
                      active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <SlotText label={slot.label} start={slot.startTime} end={slot.endTime} />
                    <SlotStatus {...slotStatus(slot.id)} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-10 w-9 shrink-0" aria-label="Previous time slot" disabled={activeSlotIndex <= 0} onClick={() => setSlotId(sortedSlots[activeSlotIndex - 1].id)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={slotPickerOpen} onOpenChange={setSlotPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 min-w-[12rem] flex-1 justify-start gap-2.5 font-normal xl:flex-none" aria-label="Choose time slot">
                    <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {activeSlot ? <span className="whitespace-nowrap text-sm font-medium tabular-nums" title={activeSlot.label ?? undefined}>{activeSlot.startTime} – {activeSlot.endTime}</span> : "Pick a slot"}
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{activeSlotIndex + 1}/{sortedSlots.length}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-1.5" align="start">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Time slots on {format(date, "EEE d MMM")}</div>
                  <div className="max-h-80 overflow-y-auto" role="listbox" aria-label="Time slots">
                    {sortedSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        role="option"
                        aria-selected={slot.id === activeSlotId}
                        onClick={() => { setSlotId(slot.id); setSlotPickerOpen(false); }}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted", slot.id === activeSlotId && "bg-primary/10")}
                      >
                        <SlotText label={slot.label} start={slot.startTime} end={slot.endTime} />
                        <span className="ml-auto"><SlotStatus {...slotStatus(slot.id)} /></span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-10 w-9 shrink-0" aria-label="Next time slot" disabled={activeSlotIndex >= sortedSlots.length - 1} onClick={() => setSlotId(sortedSlots[activeSlotIndex + 1].id)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Popover onOpenChange={(open) => { if (!open) setRoomSearch(""); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 font-normal">
                <DoorOpen className="h-4 w-4 text-muted-foreground" />
                <span><span className="font-medium">{selectedRooms.length}</span> of {rooms.length} rooms</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
              {rooms.length > ROOM_SEARCH_FROM && (
                <div className="relative mb-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder={`Search ${rooms.length} rooms`} className="h-8 pl-8 text-sm" aria-label="Search rooms" autoFocus />
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {roomSearch ? `${visibleRooms.length} match${visibleRooms.length === 1 ? "" : "es"}` : "Rooms to schedule"}
                </span>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => setSelectedRooms((prev) => [...new Set([...prev, ...visibleRooms.map((room) => room.id)])])}>
                    {roomSearch ? "Select these" : "All"}
                  </button>
                  <button type="button" className="text-muted-foreground hover:underline" onClick={() => { const hide = new Set(visibleRooms.map((room) => room.id)); setSelectedRooms((prev) => prev.filter((id) => !hide.has(id))); }}>
                    {roomSearch ? "Unselect these" : "None"}
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {visibleRooms.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">No room matches “{roomSearch}”.</p>}
                {visibleRooms.map((room) => (
                  <label key={room.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted">
                    <Checkbox checked={selectedRooms.includes(room.id)} onCheckedChange={() => toggleRoom(room.id)} />
                    <span className="min-w-0 flex-1 truncate text-sm">{room.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">cap {room.capacity} · {room.minInvigilators} inv.</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Phones: main button on top, full width; wider screens: side by side. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row xl:ml-auto">
            {entry && (
              <Button variant="outline" className="h-10 gap-2" onClick={() => void onAssign(true)} disabled={isGenerating} title="Keep locked rooms, refill the rest">
                <RotateCw className="h-4 w-4" /> Regenerate unlocked
              </Button>
            )}
            <Button className="h-10 flex-1 gap-2 shadow-elevated xl:flex-none" onClick={() => void onAssign(false)} disabled={isGenerating || selectedRooms.length === 0}>
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Generating..." : entry ? "Generate again" : "Generate schedule"}
            </Button>
          </div>
        </div>

        <ScheduleGrid date={dateStr} slotId={activeSlotId} />
      </div>

      {(entryDirty || otherDirty.length > 0) && (
        <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center px-2">
          <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-elevated backdrop-blur animate-fade-in">
            <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{entryDirty ? "Unsaved changes in this slot" : "This slot is saved"}</span>
              {otherDirty.length > 0 && (
                <span className="text-muted-foreground">
                  {" · "}also unsaved:{" "}
                  {otherDirty.slice(0, 3).map((item, index) => {
                    const slot = slots.find((candidate) => candidate.id === item.slotId);
                    return (
                      <button key={`${item.date}${item.slotId}`} type="button" className="font-medium text-primary hover:underline" onClick={() => jumpTo(item)}>
                        {index > 0 ? ", " : ""}{format(parseISO(item.date), "d MMM")} {slot?.label ?? ""}
                      </button>
                    );
                  })}
                  {otherDirty.length > 3 ? ` +${otherDirty.length - 3}` : ""}
                </span>
              )}
            </div>
            {entryDirty && (
              <Button className="gap-2" disabled={isPersisting} onClick={() => void handleSave()}>
                {isPersisting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isPersisting ? "Saving..." : "Save"}
                <kbd className="hidden rounded bg-primary-foreground/20 px-1.5 text-[10px] font-normal sm:inline">Ctrl S</kbd>
              </Button>
            )}
          </div>
        </div>
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultDate={dateStr} />
      {activeGroupId && (
        <BulkScheduleUploadModal
          open={bulkUploadOpen}
          onOpenChange={setBulkUploadOpen}
          groupId={activeGroupId}
          groupName={activeGroup?.name}
        />
      )}
    </AppLayout>
  );
}

function SlotText({ label, start, end }: { label?: string | null; start: string; end: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">{label || "Slot"}</span>
      <span className="block whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{start} – {end}</span>
    </span>
  );
}

function SlotStatus({ dirty, state, rooms }: { dirty: boolean; state: "VALID" | "INCOMPLETE" | "CONFLICT" | null; rooms: number }) {
  if (dirty) return <span className="h-2 w-2 rounded-full bg-warning" title="Unsaved changes" />;
  if (!state) return <span className="h-2 w-2 rounded-full border border-muted-foreground/40" title="Nothing scheduled" />;
  const tone = state === "VALID" ? "bg-success/15 text-success" : state === "INCOMPLETE" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
  const label = state === "VALID" ? "fully staffed" : state === "INCOMPLETE" ? "incomplete" : "has conflicts";
  return <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular-nums", tone)} title={`${rooms} rooms, ${label}`}>{rooms}</span>;
}
