import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ChevronDown, ChevronsDownUp, ChevronsUpDown, FileDown, PencilLine, Search, TriangleAlert } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { ExportDialog } from "@/components/uniguard/ExportDialog";
import { StaffProfileDialog } from "@/components/uniguard/StaffProfileDialog";
import { usePermissions } from "@/hooks";
import { formatDay } from "@/lib/dashboard/insights";
import { useUniGuard } from "@/lib/uniguard/store";
import { chiefRoomCounts, roomStaffing, staffingGapLabel, type RoomStaffing } from "@/lib/uniguard/timeline";
import type { Assignment, Room, Slot, Staff } from "@/lib/uniguard/types";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";

const TITLE = "Timeline";
const SUBTITLE = "Every exam of the selected period, day by day.";

interface RoomRow {
  assignment: Assignment;
  room: Room | undefined;
  staffing: RoomStaffing;
}

interface SlotGroup {
  slotId: string;
  slot: Slot | undefined;
  rows: RoomRow[];
  chiefRooms: Map<string, number>;
}

interface DayGroup {
  date: string;
  slots: SlotGroup[];
  rooms: number;
  needStaff: number;
}

export default function Timeline() {
  const { schedule, staff, rooms, slots, studentsPerInvigilator, isLoading, error } = useUniGuard();
  const { canEdit } = usePermissions();
  const [query, setQuery] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const slotMap = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);

  const days = useMemo<DayGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    const byDate = new Map<string, SlotGroup[]>();
    for (const entry of schedule) {
      const slot = slotMap.get(entry.slotId);
      const dayText = `${entry.day} ${entry.date} ${formatDay(entry.date, { weekday: "long", day: "numeric", month: "long" })}`.toLowerCase();
      const rows = entry.assignments
        .map((assignment) => {
          const room = roomMap.get(assignment.roomId);
          return { assignment, room, staffing: roomStaffing(assignment, room, studentsPerInvigilator) };
        })
        .filter(({ assignment, room, staffing }) => {
          if (onlyGaps && staffing.complete) return false;
          if (!needle) return true;
          const names = [assignment.chiefInvigilatorId, ...assignment.invigilatorIds].map((id) => (id ? staffMap.get(id)?.name ?? "" : ""));
          return [room?.name, assignment.subjectName, assignment.subjectCode, slot?.label, ...names]
            .some((text) => (text ?? "").toLowerCase().includes(needle)) || dayText.includes(needle);
        })
        .sort((a, b) => (a.room?.name ?? "").localeCompare(b.room?.name ?? "", undefined, { numeric: true }));
      if (rows.length === 0) continue;
      const list = byDate.get(entry.date) ?? [];
      list.push({ slotId: entry.slotId, slot, rows, chiefRooms: chiefRoomCounts(entry.assignments) });
      byDate.set(entry.date, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slotGroups]) => {
        slotGroups.sort((a, b) => (a.slot?.startTime ?? "").localeCompare(b.slot?.startTime ?? ""));
        const allRows = slotGroups.flatMap((group) => group.rows);
        return { date, slots: slotGroups, rooms: allRows.length, needStaff: allRows.filter((row) => !row.staffing.complete).length };
      });
  }, [schedule, query, onlyGaps, staffMap, roomMap, slotMap, studentsPerInvigilator]);

  const totals = useMemo(() => ({
    rooms: days.reduce((sum, day) => sum + day.rooms, 0),
    needStaff: days.reduce((sum, day) => sum + day.needStaff, 0),
  }), [days]);

  if (isLoading) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState title="Loading timeline..." description="Fetching saved schedule data from the backend." />
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

  const allCollapsed = days.length > 0 && days.every((day) => collapsed.has(day.date));
  const toggleDay = (date: string) => setCollapsed((previous) => {
    const next = new Set(previous);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    return next;
  });
  const jumpTo = (date: string) => {
    setCollapsed((previous) => { const next = new Set(previous); next.delete(date); return next; });
    requestAnimationFrame(() => document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const filtered = query.trim() !== "" || onlyGaps;

  return (
    <AppLayout
      title={TITLE}
      subtitle={SUBTITLE}
      actions={<Button className="gap-2 shadow-elevated" onClick={() => setExportOpen(true)}><FileDown className="h-4 w-4" /> Export PDF</Button>}
    >
      <TooltipProvider delayDuration={200}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff, subject, room or day" className="h-10 pl-9" aria-label="Search the timeline" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={onlyGaps} onCheckedChange={setOnlyGaps} aria-label="Only rooms that need staff" />
              Only rooms that need staff
              {totals.needStaff > 0 && !onlyGaps && <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-semibold text-warning">{totals.needStaff}</span>}
            </label>
            <div className="flex items-center gap-2 lg:ml-auto">
              {days.length > 1 && (
                <Select value="" onValueChange={jumpTo}>
                  <SelectTrigger className="h-10 w-44" aria-label="Jump to day"><SelectValue placeholder="Jump to day" /></SelectTrigger>
                  <SelectContent>
                    {days.map((day) => <SelectItem key={day.date} value={day.date}>{formatDay(day.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {days.length > 0 && (
                <Button
                  variant="outline"
                  className="h-10 gap-2"
                  onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(days.map((day) => day.date)))}
                >
                  {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
                  {allCollapsed ? "Expand all" : "Collapse all"}
                </Button>
              )}
            </div>
          </div>

          {days.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
              <CalendarRange className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-display text-lg font-semibold">{filtered ? "Nothing matches" : "No exams scheduled yet"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {onlyGaps && !query ? "Every room is fully staffed." : filtered ? "Try another search or turn off the filter." : "Generate a schedule to see it here."}
              </p>
            </div>
          ) : (
            days.map((day) => (
              <Collapsible
                key={day.date}
                id={`day-${day.date}`}
                open={!collapsed.has(day.date)}
                onOpenChange={() => toggleDay(day.date)}
                className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <CollapsibleTrigger className="group flex w-full flex-wrap items-center justify-between gap-2 bg-muted/30 px-5 py-3.5 text-left transition-colors hover:bg-muted/50">
                  <span className="flex items-center gap-3">
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                    <span className="font-display font-semibold">{formatDay(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{day.slots.length} slot{day.slots.length === 1 ? "" : "s"} · {day.rooms} room{day.rooms === 1 ? "" : "s"}</span>
                    {day.needStaff > 0
                      ? <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">{day.needStaff} need staff</span>
                      : <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">All staffed</span>}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {day.slots.map((group) => (
                    <SlotSection
                      key={group.slotId}
                      date={day.date}
                      group={group}
                      staffMap={staffMap}
                      canEdit={canEdit}
                      onProfile={setProfileId}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </TooltipProvider>
      <StaffProfileDialog staffId={profileId} open={!!profileId} onOpenChange={(open) => !open && setProfileId(null)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </AppLayout>
  );
}

function SlotSection({ date, group, staffMap, canEdit, onProfile }: {
  date: string;
  group: SlotGroup;
  staffMap: Map<string, Staff>;
  canEdit: boolean;
  onProfile: (id: string) => void;
}) {
  const gaps = group.rows.filter((row) => !row.staffing.complete).length;
  const editLink = `/scheduler?date=${date}&slot=${group.slotId}`;
  return (
    <section className="border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums">{group.slot ? `${group.slot.startTime} – ${group.slot.endTime}` : "Unknown slot"}</span>
          {group.slot?.label && <span className="text-muted-foreground">{group.slot.label}</span>}
          <span className="text-xs text-muted-foreground">· {group.rows.length} room{group.rows.length === 1 ? "" : "s"}</span>
          {gaps > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">{gaps} need staff</span>}
        </div>
        {canEdit && (
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Link to={editLink}><PencilLine className="h-3.5 w-3.5" /> Edit in Scheduler</Link>
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="stack-table w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-y border-border/70 bg-muted/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="w-48 px-5 py-2 font-medium">Room</th>
              <th className="w-48 px-3 py-2 font-medium">Subject</th>
              <th className="w-60 px-3 py-2 font-medium">Chief invigilator</th>
              <th className="px-3 py-2 font-medium">Invigilators</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map(({ assignment, room, staffing }) => {
              const chief = assignment.chiefInvigilatorId ? staffMap.get(assignment.chiefInvigilatorId) : null;
              const coveredRooms = chief ? group.chiefRooms.get(chief.id) ?? 1 : 0;
              const gap = staffingGapLabel(staffing);
              const people = assignment.invigilatorIds.map((id) => (id ? staffMap.get(id) : null)).filter((person): person is Staff => Boolean(person));
              return (
                <tr key={assignment.roomId} className={cn("border-b border-border/60 last:border-b-0 hover:bg-accent/20", !staffing.complete && "bg-warning/[0.03]")}>
                  <td data-label="Room" className="whitespace-nowrap px-5 py-2.5">
                    {canEdit
                      ? <Link to={editLink} className="font-medium hover:text-primary hover:underline">{room?.name ?? "Unknown room"}</Link>
                      : <span className="font-medium">{room?.name ?? "Unknown room"}</span>}
                  </td>
                  <td data-label="Subject" className="px-3 py-2.5 text-xs">
                    {assignment.subjectName || assignment.subjectCode
                      ? <><span className="font-medium">{assignment.subjectName}</span>{assignment.subjectCode && <span className="text-muted-foreground">{assignment.subjectName ? " · " : ""}{assignment.subjectCode}</span>}</>
                      : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td data-label="Chief invigilator" data-stack="full" className="px-3 py-2.5">
                    {chief ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => onProfile(chief.id)} className="inline-flex items-center gap-1.5 text-xs font-medium text-chief hover:underline">
                          <span className="h-1.5 w-1.5 rounded-full bg-chief" />{chief.name}
                        </button>
                        {coveredRooms > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default rounded-full bg-shared-soft px-1.5 text-[10px] font-medium text-shared">covers {coveredRooms} rooms</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {group.rows.filter((row) => row.assignment.chiefInvigilatorId === chief.id).map((row) => row.room?.name).join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Invigilators" data-stack="full" className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {people.map((person, index) => (
                        <button key={`${person.id}-${index}`} type="button" onClick={() => onProfile(person.id)} className="inline-flex items-center gap-1.5 text-xs font-medium text-invigilator hover:underline">
                          <span className="h-1.5 w-1.5 rounded-full bg-invigilator" />{person.name}
                        </button>
                      ))}
                      {gap && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                          <TriangleAlert className="h-3 w-3" /> {gap}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
