import { CalendarX2 } from "lucide-react";
import { useMemo } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDay } from "@/lib/dashboard/insights";
import { useUniGuard } from "@/lib/uniguard/store";
import { roleLabel } from "@/lib/uniguard/types";
import { cn } from "@/lib/utils";

interface Props {
  staffId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One duty session: a time slot on a day, with every room the person covers in it. */
interface Duty {
  date: string;
  slotId: string;
  start: string;
  end: string;
  slotLabel: string;
  asChief: boolean;
  rooms: Array<{ name: string; subject: string }>;
}

const initials = (name: string) => name.replace(/^Dr\.\s*/i, "").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

/** A person's schedule in the selected exam period, day by day. */
export function StaffProfileDialog({ staffId, open, onOpenChange }: Props) {
  const { staff, schedule, slots, rooms } = useUniGuard();
  const person = staff.find((candidate) => candidate.id === staffId) ?? null;

  const days = useMemo(() => {
    if (!person) return [];
    const duties = new Map<string, Duty>();
    for (const entry of schedule) {
      const slot = slots.find((candidate) => candidate.id === entry.slotId);
      for (const assignment of entry.assignments) {
        const asChief = assignment.chiefInvigilatorId === person.id;
        if (!asChief && !assignment.invigilatorIds.includes(person.id)) continue;
        const key = `${entry.date}|${entry.slotId}|${asChief}`;
        const duty = duties.get(key) ?? {
          date: entry.date,
          slotId: entry.slotId,
          start: slot?.startTime ?? "",
          end: slot?.endTime ?? "",
          slotLabel: slot?.label ?? "",
          asChief,
          rooms: [],
        };
        const subject = [assignment.subjectName, assignment.subjectCode].filter(Boolean).join(" · ");
        duty.rooms.push({ name: rooms.find((room) => room.id === assignment.roomId)?.name ?? "Room", subject });
        duties.set(key, duty);
      }
    }
    const byDay = new Map<string, Duty[]>();
    for (const duty of [...duties.values()].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))) {
      duty.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      byDay.set(duty.date, [...(byDay.get(duty.date) ?? []), duty]);
    }
    return [...byDay.entries()];
  }, [person, schedule, slots, rooms]);

  if (!person) return null;
  const chief = person.role === "CHIEF_INVIGILATOR";
  const sessions = days.reduce((sum, [, duties]) => sum + duties.length, 0);
  const roomCount = days.reduce((sum, [, duties]) => sum + duties.reduce((n, duty) => n + duty.rooms.length, 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold", chief ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>
              {initials(person.name)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{person.name}</DialogTitle>
              <DialogDescription>
                {roleLabel(person.role)}{person.department ? ` · ${person.department}` : ""}
              </DialogDescription>
            </div>
          </div>
          {sessions > 0 && (
            <p className="pt-2 text-sm">
              <span className="font-semibold">{sessions}</span> {sessions === 1 ? "session" : "sessions"} on <span className="font-semibold">{days.length}</span> {days.length === 1 ? "day" : "days"}
              {roomCount > sessions && <span className="text-muted-foreground"> · {roomCount} rooms</span>}
              <span className="text-muted-foreground"> in this exam period</span>
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {days.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CalendarX2 className="h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">No duties yet</p>
              <p className="text-sm text-muted-foreground">{person.name} has no exams in this exam period.</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {days.map(([date, duties]) => (
                <li key={date}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h3>
                  <ul className="space-y-1.5">
                    {duties.map((duty) => (
                      <li key={`${duty.slotId}-${duty.asChief}`} className="flex gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="w-24 shrink-0">
                          <div className="text-sm font-semibold tabular-nums">{duty.start}–{duty.end}</div>
                          {duty.slotLabel && <div className="text-[11px] text-muted-foreground">{duty.slotLabel}</div>}
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          {duty.rooms.map((room) => (
                            <div key={room.name} className="truncate">
                              <span className="font-medium">{room.name}</span>
                              {room.subject && <span className="text-muted-foreground"> · {room.subject}</span>}
                            </div>
                          ))}
                        </div>
                        <span className={cn("h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", duty.asChief ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>
                          {duty.asChief ? (duty.rooms.length > 1 ? `Chief · ${duty.rooms.length} rooms` : "Chief") : "Invigilator"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
