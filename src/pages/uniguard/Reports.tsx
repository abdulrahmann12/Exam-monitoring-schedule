import { AlertTriangle, Download, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { FairnessByRole, PersonWorkload } from "@/api";
import { reportsService } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { useAnalyticsQuery, useWorkloadReportQuery } from "@/hooks/useReports";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const SUBTITLE = "Sessions and hours per person for finance, workload per department, fairness and staffing gaps for the selected exam period.";

function hours(value: number): string {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function roleName(role: string | null): string {
  return role === "CHIEF_INVIGILATOR" ? "Chief invigilator" : role === "INVIGILATOR" ? "Invigilator" : "—";
}

export default function Reports() {
  const { activeGroup, activeGroupId } = useScheduleGroup();
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    if (!activeGroupId) {
      return;
    }
    setExporting(true);
    try {
      const response = await reportsService.exportWorkloadCsv(activeGroupId, activeGroup?.name ?? "exam-period");
      if (!response.success) {
        throw response.error;
      }
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
        <Tabs defaultValue="hours" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hours">Hours per person</TabsTrigger>
            <TabsTrigger value="analytics">Fairness &amp; coverage</TabsTrigger>
          </TabsList>
          <TabsContent value="hours"><HoursPerPerson scheduleGroupId={activeGroupId} /></TabsContent>
          <TabsContent value="analytics"><Analytics scheduleGroupId={activeGroupId} /></TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}

function HoursPerPerson({ scheduleGroupId }: { scheduleGroupId: string }) {
  const query = useWorkloadReportQuery(scheduleGroupId);
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const all = query.data?.people ?? [];
    return term ? all.filter((row) => `${row.name} ${row.department ?? ""}`.toLowerCase().includes(term)) : all;
  }, [query.data, filter]);

  if (query.isLoading) {
    return <LoadingState title="Calculating hours..." />;
  }
  if (query.isError || !query.data) {
    return <ErrorState description={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const report = query.data;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-3" aria-label="Totals">
        <Tile label="Staff" value={String(report.staff)} />
        <Tile label="Sessions" value={String(report.sessions)} />
        <Tile label="Hours" value={hours(report.hours)} />
      </section>
      <p className="text-xs text-muted-foreground">
        A session is one sitting (date and time). A chief covering two rooms at the same time works one session.
        Staff without duties are listed with zero.
      </p>
      <Input placeholder="Filter by name or department" value={filter} onChange={(event) => setFilter(event.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Sessions</th>
              <th className="px-4 py-3 text-right font-medium">Hours</th>
              <th className="px-4 py-3 text-right font-medium">Rooms (chief / invigilator)</th>
              <th className="px-4 py-3 text-right font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: PersonWorkload) => (
              <tr key={row.personId} className={`border-t border-border ${row.sessions === 0 ? "text-muted-foreground" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{row.name}</div>
                  {!row.active && <div className="text-xs text-muted-foreground">inactive</div>}
                </td>
                <td className="px-4 py-2.5">{row.department ?? "—"}</td>
                <td className="px-4 py-2.5">{roleName(row.role)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.sessions}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{hours(row.hours)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.roomsAsChief} / {row.roomsAsInvigilator}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Analytics({ scheduleGroupId }: { scheduleGroupId: string }) {
  const query = useAnalyticsQuery(scheduleGroupId);
  if (query.isLoading) {
    return <LoadingState title="Calculating..." />;
  }
  if (query.isError || !query.data) {
    return <ErrorState description={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const { fairness, departments, coverage } = query.data;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><Scale className="h-4 w-4" /> Fairness</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          100 means everyone of this role has the same hours; lower means the hours sit with fewer people. Leave and availability
          make 100 impossible in practice; compare periods or look for people with no duties.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {fairness.map((item) => <FairnessCard key={item.role} item={item} />)}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Workload per department</h2>
        {departments.length === 0 ? <p className="text-sm text-muted-foreground">No staff yet.</p> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 text-right font-medium">Staff</th>
                  <th className="px-4 py-3 text-right font-medium">Sessions</th>
                  <th className="px-4 py-3 text-right font-medium">Hours</th>
                  <th className="px-4 py-3 text-right font-medium">Hours per person</th>
                  <th className="px-4 py-3 font-medium">Share of all hours</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.department} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{department.department}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{department.staff}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{department.sessions}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{hours(department.hours)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{hours(department.hoursPerPerson)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(department.shareOfHours, 100)}%` }} /></div>
                        <span className="tabular-nums text-xs">{department.shareOfHours}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Coverage gaps</h2>
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Exam rooms" value={String(coverage.examRooms)} />
          <Tile label="Fully staffed" value={String(coverage.fullyStaffed)} />
          <Tile label="Missing invigilators" value={String(coverage.missingInvigilators)} warn={coverage.missingInvigilators > 0} />
          <Tile label="Rooms without a chief" value={String(coverage.missingChiefs)} warn={coverage.missingChiefs > 0} />
        </div>
        {coverage.gaps.length === 0 ? (
          <p className="text-sm text-success">Every exam room has a chief and enough invigilators.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Missing</th>
                </tr>
              </thead>
              <tbody>
                {coverage.gaps.map((gap) => {
                  const missing = Math.max(gap.requiredInvigilators - gap.assignedInvigilators, 0);
                  return (
                    <tr key={gap.assignmentId} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2.5">{gap.examDate}</td>
                      <td className="px-4 py-2.5">{gap.slot}</td>
                      <td className="px-4 py-2.5">{gap.room}</td>
                      <td className="px-4 py-2.5">{gap.subject || "—"}</td>
                      <td className="px-4 py-2.5 text-destructive">
                        {[gap.chiefMissing ? "chief" : null, missing > 0 ? `${missing} invigilator(s) (${gap.assignedInvigilators}/${gap.requiredInvigilators})` : null]
                          .filter(Boolean).join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FairnessCard({ item }: { item: FairnessByRole }) {
  const tone = item.score === null ? "text-muted-foreground" : item.score >= 80 ? "text-success" : item.score >= 60 ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{item.role === "CHIEF_INVIGILATOR" ? "Chief invigilators" : "Invigilators"}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{item.score === null ? "—" : item.score}<span className="text-base text-muted-foreground"> / 100</span></div>
      <div className="mt-2 text-xs text-muted-foreground">
        {item.staff} staff · hours min {hours(item.minHours)} · avg {hours(item.averageHours)} · max {hours(item.maxHours)}
        {item.withoutDuty > 0 && <span className="text-warning"> · {item.withoutDuty} without any duty</span>}
      </div>
    </div>
  );
}

function Tile({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
