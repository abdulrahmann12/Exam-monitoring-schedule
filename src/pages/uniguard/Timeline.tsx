import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "@/components/app/PageState";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { useUniGuard } from "@/lib/uniguard/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search, FileDown, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StaffProfileDialog } from "@/components/uniguard/StaffProfileDialog";
import { ExportDialog } from "@/components/uniguard/ExportDialog";
import { getErrorMessage } from "@/utils/error";

const timeLabel = (slot?: { startTime: string; endTime: string }) => slot ? `${slot.startTime} – ${slot.endTime}` : "—";

export default function Timeline() {
  const { schedule, staff, rooms, slots, isLoading, error } = useUniGuard();
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const slotMap = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byDate = new Map<string, typeof schedule>();
    for (const e of schedule) {
      const slot = slotMap.get(e.slotId);
      const filteredAssignments = e.assignments.filter((a) => {
        if (!q) return true;
        const room = roomMap.get(a.roomId);
        if (room?.name.toLowerCase().includes(q)) return true;
        const subjName = (a.subjectName ?? slot?.subjectName ?? "").toLowerCase();
        const subjCode = (a.subjectCode ?? slot?.subjectCode ?? "").toLowerCase();
        if (subjName.includes(q) || subjCode.includes(q)) return true;
        if (a.chiefInvigilatorId && staffMap.get(a.chiefInvigilatorId)?.name.toLowerCase().includes(q)) return true;
        if (a.invigilatorIds.some((id) => id && staffMap.get(id)?.name.toLowerCase().includes(q))) return true;
        return e.day.toLowerCase().includes(q) || e.date.includes(q);
      });
      if (filteredAssignments.length === 0) continue;
      const arr = byDate.get(e.date) ?? [];
      arr.push({ ...e, assignments: filteredAssignments });
      byDate.set(e.date, arr);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [schedule, query, staffMap, roomMap, slotMap]);

  if (isLoading) {
    return (
      <AppLayout title="Master Timeline" subtitle="Scheduled exams for the selected period, grouped by day.">
        <LoadingState title="Loading timeline..." description="Fetching saved schedule data from the backend." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Master Timeline" subtitle="Scheduled exams for the selected period, grouped by day.">
        <ErrorState description={getErrorMessage(error)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Master Timeline" subtitle="Scheduled exams for the selected period, grouped by day." actions={<Button className="gap-2 shadow-elevated" onClick={() => setExportOpen(true)}><FileDown className="h-4 w-4" /> Export PDF</Button>}>
      <div className="space-y-5">
        <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff, subject code, room, or day..." className="pl-9 bg-card" /></div>
        {grouped.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center"><CalendarRange className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><h3 className="text-display text-lg font-semibold">No exams scheduled yet</h3><p className="text-sm text-muted-foreground mt-1">Generate a schedule to see it here.</p></div> : (
          <div className="space-y-3">{grouped.map(([date, entries]) => {
            const totalRooms = entries.reduce((n, e) => n + e.assignments.length, 0);
            return <Collapsible key={date} defaultOpen className="rounded-xl border border-border bg-card shadow-card overflow-hidden"><CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-smooth group"><div className="flex items-center gap-3"><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" /><span className="font-display font-semibold">{date}</span><Badge variant="outline" className="font-mono text-xs">{entries[0].day}</Badge></div><span className="text-xs text-muted-foreground">{entries.length} slot{entries.length > 1 ? "s" : ""} · {totalRooms} room{totalRooms > 1 ? "s" : ""}</span></CollapsibleTrigger><CollapsibleContent><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/10 border-t border-border"><th className="px-5 py-2.5 font-medium w-32">Time Range</th><th className="px-3 py-2.5 font-medium w-28">Room</th><th className="px-3 py-2.5 font-medium w-44">Subject (Code)</th><th className="px-3 py-2.5 font-medium">Chief Invigilator</th><th className="px-3 py-2.5 font-medium">Invigilators</th></tr></thead><tbody>{entries.flatMap((e) => e.assignments.map((a, i) => {
              const room = roomMap.get(a.roomId); const slot = slotMap.get(e.slotId); const chief = a.chiefInvigilatorId ? staffMap.get(a.chiefInvigilatorId) : null;
              const subjN = a.subjectName ?? slot?.subjectName ?? "—";
              const subjC = a.subjectCode ?? slot?.subjectCode ?? "";
              return <tr key={`${e.slotId}-${a.roomId}`} className={cn("border-t border-border hover:bg-accent/20 transition-smooth", i === 0 && "bg-muted/5")}><td className="px-5 py-2.5 text-xs font-medium">{timeLabel(slot)}</td><td className="px-3 py-2.5"><span className="font-semibold text-xs">{room?.name}</span></td><td className="px-3 py-2.5 text-xs"><span className="font-medium">{subjN}</span>{subjC && <span className="text-muted-foreground"> ({subjC})</span>}</td><td className="px-3 py-2.5">{chief ? <button onClick={() => setProfileId(chief.id)} className="text-xs font-medium text-chief hover:underline inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chief" />{chief.name}{a.sharedChief && <Badge className="bg-shared-soft text-shared border-shared/20 text-[9px] py-0 px-1 h-3.5">Shared</Badge>}</button> : <span className="text-xs text-destructive italic">Unassigned</span>}</td><td className="px-3 py-2.5"><div className="flex flex-wrap items-center gap-2">{a.invigilatorIds.map((id, j) => { const inv = id ? staffMap.get(id) : null; return inv ? <button key={j} onClick={() => setProfileId(inv.id)} className="text-xs font-medium text-invigilator hover:underline inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-invigilator" />{inv.name}</button> : <span key={j} className="text-[10px] text-destructive italic">Missing</span>; })}</div></td></tr>;
            }))}</tbody></table></CollapsibleContent></Collapsible>;
          })}</div>
        )}
      </div>
      <StaffProfileDialog staffId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </AppLayout>
  );
}
