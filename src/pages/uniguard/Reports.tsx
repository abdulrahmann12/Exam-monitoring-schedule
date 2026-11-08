import { ArrowRight, CalendarDays, CheckCircle2, DoorOpen, Download, TriangleAlert, Users } from "lucide-react";
import { useIsPhone } from "@/hooks/use-mobile";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import type { FairnessByRole, PersonWorkload } from "@/api";
import { reportsService } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { pageOf, TablePagination } from "@/components/app/TablePagination";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { useAssignmentsQuery } from "@/hooks";
import { useAnalyticsQuery, useWorkloadReportQuery } from "@/hooks/useReports";
import { formatDay } from "@/lib/dashboard/insights";
import { examsPerDay, formatHours, hoursDistribution, topShare } from "@/lib/reports/insights";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const SUBTITLE = "How the selected exam period looks: exams per day, staffing, how fairly the work is spread, and hours for finance.";

type RoleFilter = "ALL" | "CHIEF_INVIGILATOR" | "INVIGILATOR";

/** Cuts long chart labels; the tooltip still shows the full name. */
function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function roleName(role: string | null): string {
  return role === "CHIEF_INVIGILATOR" ? "Chief invigilator" : role === "INVIGILATOR" ? "Invigilator" : "—";
}

export default function Reports() {
  const { activeGroup, activeGroupId } = useScheduleGroup();
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    if (!activeGroupId) return;
    setExporting(true);
    try {
      const response = await reportsService.exportWorkloadCsv(activeGroupId, activeGroup?.name ?? "exam-period");
      if (!response.success) throw response.error;
      toast.success("Downloaded. The file opens in Excel.");
    } catch (error) {
      showErrorToast(error, { title: "Could not export." });
    } finally {
      setExporting(false);
    }
  }

  const actions = (
    <Button className="gap-2" disabled={!activeGroupId || exporting} onClick={() => void exportCsv()}>
      <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export hours (Excel)"}
    </Button>
  );

  return (
    <AppLayout title="Reports" subtitle={SUBTITLE} actions={actions}>
      {!activeGroupId ? (
        <EmptyState title="No exam period selected" description="Choose an exam period at the top of the page." />
      ) : (
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="flex w-full sm:inline-flex sm:w-auto">
            <TabsTrigger value="overview" className="flex-auto sm:flex-none">Overview</TabsTrigger>
            <TabsTrigger value="fairness" className="flex-auto sm:flex-none"><span aria-hidden="true" className="sm:hidden">Fairness</span><span className="sr-only sm:not-sr-only">Workload &amp; fairness</span></TabsTrigger>
            <TabsTrigger value="hours" className="flex-auto sm:flex-none"><span aria-hidden="true" className="sm:hidden">Hours</span><span className="sr-only sm:not-sr-only">Hours per person</span></TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><Overview scheduleGroupId={activeGroupId} /></TabsContent>
          <TabsContent value="fairness"><Fairness scheduleGroupId={activeGroupId} /></TabsContent>
          <TabsContent value="hours"><HoursPerPerson scheduleGroupId={activeGroupId} /></TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

const roomsChart = { rooms: { label: "Exam rooms", color: "hsl(var(--primary))" } } satisfies ChartConfig;

function Overview({ scheduleGroupId }: { scheduleGroupId: string }) {
  const analytics = useAnalyticsQuery(scheduleGroupId);
  const workload = useWorkloadReportQuery(scheduleGroupId);
  const assignments = useAssignmentsQuery();
  const days = useMemo(() => examsPerDay(assignments.data?.items ?? []), [assignments.data]);

  if (analytics.isLoading || workload.isLoading || assignments.isPending) return <LoadingState title="Calculating..." />;
  if (analytics.isError || workload.isError || !analytics.data || !workload.data) {
    return <ErrorState description={getErrorMessage(analytics.error ?? workload.error)} onRetry={() => { void analytics.refetch(); void workload.refetch(); }} />;
  }

  const { coverage } = analytics.data;
  const used = workload.data.people.filter((person) => person.sessions > 0).length;
  const total = workload.data.people.length;
  const coveragePercent = coverage.examRooms === 0 ? 0 : Math.round((coverage.fullyStaffed / coverage.examRooms) * 100);
  const peak = days.reduce<{ date: string; rooms: number } | null>((best, day) => (!best || day.rooms > best.rooms ? day : best), null);

  if (coverage.examRooms === 0) {
    return <EmptyState title="Nothing scheduled yet" description="Reports fill in as soon as exam rooms are scheduled in this exam period." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CalendarDays} label="Exam days" value={String(days.length)} hint={peak ? `Busiest: ${formatDay(peak.date)} (${peak.rooms} rooms)` : undefined} />
        <Kpi icon={DoorOpen} label="Exam rooms" value={String(coverage.examRooms)} hint={`${workload.data.sessions} staff sessions · ${formatHours(workload.data.hours)} h`} />
        <Kpi icon={Users} label="Staff used" value={`${used} of ${total}`} hint={total - used > 0 ? `${total - used} have no duty yet` : "Everyone has duties"} />
        <Kpi
          icon={coverage.withGaps > 0 ? TriangleAlert : CheckCircle2}
          tone={coverage.withGaps > 0 ? "warning" : "success"}
          label="Fully staffed"
          value={`${coveragePercent}%`}
          hint={coverage.withGaps > 0 ? `${coverage.withGaps} room${coverage.withGaps === 1 ? "" : "s"} need staff` : "Every room has its staff"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Exam rooms per day" description="Hover a day to see how many rooms still need staff.">
          <ChartContainer config={roomsChart} className="aspect-auto h-64 w-full">
            <BarChart data={days} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: string) => formatDay(value, { day: "numeric", month: "short" })} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                content={<ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const day = payload?.[0]?.payload as { date: string; needStaff: number } | undefined;
                    return day ? `${formatDay(day.date, { weekday: "long", day: "numeric", month: "long" })}${day.needStaff ? ` · ${day.needStaff} need staff` : ""}` : "";
                  }}
                />}
              />
              <Bar dataKey="rooms" fill="var(--color-rooms)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel title="Staffing" description="Rooms with their chief and every required invigilator.">
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold tabular-nums">{coverage.fullyStaffed}<span className="text-base font-normal text-muted-foreground"> / {coverage.examRooms}</span></span>
                <span className="text-sm text-muted-foreground">{coveragePercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${coveragePercent}% of rooms fully staffed`}>
                <div className="h-full rounded-full bg-success" style={{ width: `${coveragePercent}%` }} />
              </div>
            </div>
            {coverage.withGaps > 0 ? (
              <>
                <ul className="space-y-1.5 text-sm">
                  {coverage.missingChiefs > 0 && <li className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warning" /> {coverage.missingChiefs} room{coverage.missingChiefs === 1 ? "" : "s"} without a chief</li>}
                  {coverage.missingInvigilators > 0 && <li className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warning" /> {coverage.missingInvigilators} invigilator seat{coverage.missingInvigilators === 1 ? "" : "s"} empty</li>}
                </ul>
                <ul className="divide-y divide-border rounded-lg border border-border text-xs">
                  {coverage.gaps.slice(0, 4).map((gap) => (
                    <li key={gap.assignmentId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate"><span className="font-medium">{gap.room}</span> · {formatDay(gap.examDate)} · {gap.slot}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm" className="w-full gap-1">
                  <Link to="/timeline">Fix in the Timeline <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Every exam room has its chief and invigilators.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Workload & fairness ───────────────────────────────────────────────────

const peopleChart = { people: { label: "People", color: "hsl(var(--primary))" } } satisfies ChartConfig;
const deptChart = { hours: { label: "Hours", color: "hsl(var(--primary))" } } satisfies ChartConfig;

function Fairness({ scheduleGroupId }: { scheduleGroupId: string }) {
  const analytics = useAnalyticsQuery(scheduleGroupId);
  const workload = useWorkloadReportQuery(scheduleGroupId);
  const [role, setRole] = useState<Exclude<RoleFilter, "ALL">>("INVIGILATOR");
  const isPhone = useIsPhone();

  const people = useMemo(() => (workload.data?.people ?? []).filter((person) => person.active && person.role === role), [workload.data, role]);
  const bands = useMemo(() => hoursDistribution(people), [people]);
  const share = useMemo(() => topShare(people), [people]);
  const sorted = useMemo(() => [...people].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)), [people]);

  if (analytics.isLoading || workload.isLoading) return <LoadingState title="Calculating..." />;
  if (analytics.isError || workload.isError || !analytics.data || !workload.data) {
    return <ErrorState description={getErrorMessage(analytics.error ?? workload.error)} onRetry={() => { void analytics.refetch(); void workload.refetch(); }} />;
  }

  const fairness = analytics.data.fairness.find((item) => item.role === role);
  const departments = [...analytics.data.departments].sort((a, b) => b.hours - a.hours);
  const busiest = sorted.filter((person) => person.hours > 0).slice(0, 5);
  const idle = sorted.filter((person) => person.hours === 0);
  const roleLabel = role === "CHIEF_INVIGILATOR" ? "chief invigilators" : "invigilators";

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Role">
        {(["INVIGILATOR", "CHIEF_INVIGILATOR"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={role === value}
            onClick={() => setRole(value)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", role === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {value === "CHIEF_INVIGILATOR" ? "Chief invigilators" : "Invigilators"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={`How the work is spread among ${roleLabel}`} description="People per band of hours worked in this exam period.">
          <ChartContainer config={peopleChart} className="aspect-auto h-60 w-full">
            <BarChart data={bands} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="band" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent />} />
              <Bar dataKey="people" fill="var(--color-people)" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel title="In plain words">
          <FairnessSummary fairness={fairness} share={share} total={people.length} roleLabel={roleLabel} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Most hours" description="Consider giving their next duties to someone else.">
          {busiest.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has duties yet.</p> : (
            <ol className="space-y-2.5">
              {busiest.map((person) => (
                <li key={person.personId} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 sm:truncate">
                    <span className="block truncate sm:inline">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground sm:inline sm:text-sm"><span className="hidden sm:inline"> · </span>{person.department ?? "—"}</span>
                  </span>
                  <div className="h-1.5 w-12 shrink-0 overflow-hidden sm:w-24 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(person.hours / Math.max(1, busiest[0].hours)) * 100}%` }} /></div>
                  <span className="w-12 shrink-0 text-right font-medium tabular-nums sm:w-14">{formatHours(person.hours)} h</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title={`No duty yet (${idle.length})`} description="Available people the Scheduler can use first.">
          {idle.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Everyone has at least one duty.</p> : (
            <>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {idle.map((person) => <span key={person.personId} className="rounded-full bg-muted px-2.5 py-1 text-xs">{person.name}</span>)}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
                <Link to="/scheduler">Open the Scheduler <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Hours per department" description="All roles. Hover a bar for staff and hours per person.">
        {departments.length === 0 ? <p className="text-sm text-muted-foreground">No staff yet.</p> : (
          <ChartContainer config={deptChart} className="aspect-auto w-full" style={{ height: Math.max(140, departments.length * 40 + 20) }}>
            <BarChart data={departments} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="department"
                tickLine={false}
                axisLine={false}
                width={isPhone ? 96 : 150}
                tickFormatter={(name: string) => shorten(name, isPhone ? 13 : 22)}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                content={<ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { department: string; staff: number; hoursPerPerson: number; shareOfHours: number } | undefined;
                    return row ? (
                      <>
                        <span className="block">{row.department}</span>
                        <span className="block font-normal text-muted-foreground">{row.staff} staff · {formatHours(row.hoursPerPerson)} h each · {row.shareOfHours}% of all</span>
                      </>
                    ) : "";
                  }}
                />}
              />
              <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ChartContainer>
        )}
      </Panel>
    </div>
  );
}

function FairnessSummary({ fairness, share, total, roleLabel }: {
  fairness: FairnessByRole | undefined;
  share: { people: number; percent: number } | null;
  total: number;
  roleLabel: string;
}) {
  if (!fairness || total === 0) return <p className="text-sm text-muted-foreground">No {roleLabel} yet.</p>;
  if (!share) return <p className="text-sm text-muted-foreground">No {roleLabel} have duties yet.</p>;
  const balanced = fairness.score !== null && fairness.score >= 70;
  return (
    <div className="space-y-3 text-sm">
      <p>
        The busiest <span className="font-semibold">{share.people}</span> of {total} {roleLabel} do{" "}
        <span className="font-semibold">{share.percent}%</span> of the hours.
      </p>
      <p>
        Hours range from <span className="font-semibold">{formatHours(fairness.minHours)}</span> to{" "}
        <span className="font-semibold">{formatHours(fairness.maxHours)}</span> (average {formatHours(fairness.averageHours)}).
      </p>
      {fairness.withoutDuty > 0 && (
        <p className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {fairness.withoutDuty} {roleLabel} have no duty at all.</p>
      )}
      <p className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", balanced ? "bg-success/10 text-success" : "bg-warning/10")}>
        {balanced ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4 text-warning" />}
        {balanced ? "The work is spread fairly." : "The work sits with few people. Give upcoming duties to those with fewer hours."}
        {fairness.score !== null && <span className="ml-auto whitespace-nowrap text-muted-foreground">balance {fairness.score}/100</span>}
      </p>
    </div>
  );
}

// ── Hours per person (finance) ────────────────────────────────────────────

function HoursPerPerson({ scheduleGroupId }: { scheduleGroupId: string }) {
  const query = useWorkloadReportQuery(scheduleGroupId);
  const [filter, setFilter] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  // Who to list. People without duties have 0 hours, so with "Everyone" they sit at the very end of the
  // last page; "Without duties" shows exactly them.
  const [duty, setDuty] = useState<"WITH" | "WITHOUT" | "ALL">("WITH");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (query.data?.people ?? [])
      .filter((row) => duty === "ALL" || (duty === "WITH" ? row.sessions > 0 : row.sessions === 0))
      .filter((row) => role === "ALL" || row.role === role)
      .filter((row) => !term || `${row.name} ${row.department ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  }, [query.data, filter, role, duty]);

  useEffect(() => setPage(0), [filter, role, duty]);

  if (query.isLoading) return <LoadingState title="Calculating hours..." />;
  if (query.isError || !query.data) return <ErrorState description={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const report = query.data;
  const maxHours = Math.max(1, ...rows.map((row) => row.hours));
  const totals = rows.reduce((sum, row) => ({ sessions: sum.sessions + row.sessions, hours: sum.hours + row.hours }), { sessions: 0, hours: 0 });
  const idleCount = report.people.filter((row) => row.sessions === 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Totals">
        <Kpi icon={Users} label="Staff with duties" value={`${report.people.length - idleCount} of ${report.people.length}`} />
        <Kpi icon={CalendarDays} label="Sessions" value={String(report.sessions)} />
        <Kpi icon={DoorOpen} label="Hours" value={formatHours(report.hours)} />
      </div>
      <p className="text-xs text-muted-foreground">A session is one sitting (date and time). A chief covering two rooms at the same time works one session.</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Filter by name or department" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 bg-card sm:max-w-xs" aria-label="Filter people" />
        <div className="inline-flex w-fit rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Role">
          {([["ALL", "Everyone"], ["CHIEF_INVIGILATOR", "Chiefs"], ["INVIGILATOR", "Invigilators"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={role === value} onClick={() => setRole(value)}
              className={cn("rounded-md px-3 py-1 text-xs font-medium", role === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex w-fit rounded-lg bg-muted/60 p-1 sm:ml-auto" role="tablist" aria-label="Duties">
          {([["WITH", "With duties", report.people.length - idleCount], ["WITHOUT", "Without duties", idleCount], ["ALL", "Everyone", report.people.length]] as const).map(([value, label, count]) => (
            <button key={value} type="button" role="tab" aria-selected={duty === value} onClick={() => setDuty(value)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium", duty === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {label} <span className={cn("tabular-nums", value === "WITHOUT" && count > 0 ? "text-warning" : "text-muted-foreground")}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nobody to show"
          description={duty === "WITHOUT" ? "Everyone has at least one duty in this exam period." : duty === "WITH" ? "Nobody has duties yet, or the filter hides them." : "Try another filter."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="stack-table w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sessions</th>
                  <th className="px-4 py-2.5 font-medium">Hours</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rooms (chief / inv.)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Days</th>
                </tr>
              </thead>
              <tbody>
                {pageOf(rows, page, pageSize).map((row: PersonWorkload) => (
                  <tr key={row.personId} className={cn("border-t border-border", row.sessions === 0 && "text-muted-foreground")}>
                    <td data-stack="title" className="px-4 py-2.5">
                      <div className="font-medium">{row.name}</div>
                      {!row.active && <div className="text-xs text-muted-foreground">inactive</div>}
                    </td>
                    <td data-label="Department" className="px-4 py-2.5">{row.department ?? "—"}</td>
                    <td data-label="Role" className="px-4 py-2.5">{roleName(row.role)}</td>
                    <td data-label="Sessions" className="px-4 py-2.5 text-right tabular-nums">{row.sessions}</td>
                    <td data-label="Hours" className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(row.hours / maxHours) * 100}%` }} /></div>
                        <span className="tabular-nums">{formatHours(row.hours)}</span>
                      </div>
                    </td>
                    <td data-label="Rooms (chief / inv.)" className="px-4 py-2.5 text-right tabular-nums">{row.roomsAsChief} / {row.roomsAsInvigilator}</td>
                    <td data-label="Days" className="px-4 py-2.5 text-right tabular-nums">{row.days}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td data-stack="full" className="px-4 py-2.5" colSpan={3}>Total ({rows.length} {rows.length === 1 ? "person" : "people"})</td>
                  <td data-label="Sessions" className="px-4 py-2.5 text-right tabular-nums">{totals.sessions}</td>
                  <td data-label="Hours" className="px-4 py-2.5 tabular-nums">{formatHours(totals.hours)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={rows.length} noun="people" onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, hint, tone = "primary" }: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "success" | "warning";
}) {
  const tones = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning" };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="h-4 w-4" /></div>
      </div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Panel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      <header className="border-b border-border/70 px-5 py-3.5">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
