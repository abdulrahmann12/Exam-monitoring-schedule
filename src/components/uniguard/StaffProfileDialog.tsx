import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUniGuard } from "@/lib/uniguard/store";
import { Staff, roleLabel } from "@/lib/uniguard/types";
import { cn } from "@/lib/utils";
import { CalendarDays, MapPin, TrendingUp, AlertTriangle, type LucideIcon } from "lucide-react";
import { DayBadges } from "./DayBadges";
import { UnavailabilityPanel } from "./UnavailabilityPanel";
import { useMemo } from "react";

interface Props {
  staffId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timeLabel = (slot?: { startTime: string; endTime: string }) => slot ? `${slot.startTime} – ${slot.endTime}` : "";
const initials = (name: string) => name.replace(/^Dr\.\s*/, "").split(" ").map((s) => s[0]).slice(0, 2).join("");

export function StaffProfileDialog({ staffId, open, onOpenChange }: Props) {
  const { staff, schedule, slots, rooms } = useUniGuard();
  const person = staff.find((s) => s.id === staffId) ?? null;

  const assignments = useMemo(() => {
    if (!person) return [];
    const out: { date: string; day: string; slotLabel: string; roomName: string; role: string; subject: string }[] = [];
    for (const e of schedule) {
      for (const a of e.assignments) {
        const room = rooms.find((r) => r.id === a.roomId);
        const slot = slots.find((s) => s.id === e.slotId);
        const sName = a.subjectName ?? slot?.subjectName ?? "";
        const sCode = a.subjectCode ?? slot?.subjectCode ?? "";
        const subject = sName ? `${sName}${sCode ? ` (${sCode})` : ""}` : "";
        if (a.chiefInvigilatorId === person.id) out.push({ date: e.date, day: e.day, slotLabel: timeLabel(slot), roomName: room?.name ?? "", role: "Chief Invigilator", subject });
        a.invigilatorIds.forEach((id, i) => {
          if (id === person.id) out.push({ date: e.date, day: e.day, slotLabel: timeLabel(slot), roomName: room?.name ?? "", role: `Invigilator #${i + 1}`, subject });
        });
      }
    }
    return out.sort((a, b) => (a.date + a.slotLabel).localeCompare(b.date + b.slotLabel));
  }, [person, schedule, slots, rooms]);

  if (!person) return null;
  const tone = person.role === "CHIEF_INVIGILATOR" ? "chief" : "invigilator";
  const avg = staff.reduce((s, p) => s + p.totalAssignments, 0) / Math.max(1, staff.length);
  const overAssigned = person.totalAssignments > Math.max(2, Math.ceil(avg * 1.5));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="sr-only">{person.name}</DialogTitle></DialogHeader>
        <div className="flex items-start gap-4">
          <div className={cn("h-14 w-14 rounded-full grid place-items-center text-base font-semibold shrink-0", tone === "chief" ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>{initials(person.name)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-display text-xl font-bold">{person.name}</h2>
              <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium", tone === "chief" ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>{roleLabel(person.role)}</span>
              {overAssigned && <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium"><AlertTriangle className="h-3 w-3" /> Over-assigned</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {person.department}</span><span className="font-mono">{person.id}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Stat icon={TrendingUp} label="Total assignments" value={`${person.totalAssignments}×`} />
          <Stat icon={CalendarDays} label="Working days" value={`${person.workingDays.length}/5`} />
          <Stat icon={TrendingUp} label="Vs. team avg" value={`${avg > 0 ? Math.round((person.totalAssignments / avg) * 100) : 0}%`} />
        </div>
        <div><div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Availability</div><DayBadges value={person.workingDays} readOnly /></div>
        <UnavailabilityPanel personId={person.id} />
        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 sticky top-0 bg-background pb-2">Invigilation history ({assignments.length})</div>
          {assignments.length === 0 ? <div className="text-sm text-muted-foreground italic py-6 text-center">No assignments yet.</div> : (
            <div className="space-y-1.5">{assignments.map((a, i) => <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 transition-smooth"><div className="text-[11px] font-mono text-muted-foreground w-20 shrink-0">{a.date}</div><div className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-12 text-center shrink-0">{a.day}</div><div className="text-xs font-medium w-32 shrink-0">{a.slotLabel}</div><div className="text-xs text-foreground flex-1 truncate"><span className="font-semibold">{a.roomName}</span>{a.subject && <span className="text-muted-foreground"> · {a.subject}</span>}</div><span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", a.role === "Chief Invigilator" ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>{a.role}</span></div>)}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card/50 px-3 py-2"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium"><Icon className="h-3 w-3" /> {label}</div><div className="text-display text-lg font-bold mt-0.5">{value}</div></div>;
}
