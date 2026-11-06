import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, X } from "lucide-react";
import { useDeferredValue, useState } from "react";

import type { AuditCategory, AuditEvent, AuditOutcome, AuditQuery } from "@/api";
import { auditService } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

const PAGE_SIZE = 50;
const ALL = "ALL";

const CATEGORIES: Array<{ value: AuditCategory; label: string }> = [
  { value: "AUTH", label: "Sign-in & passwords" },
  { value: "SECURITY", label: "Security alerts" },
  { value: "USERS", label: "Users" },
  { value: "PEOPLE", label: "People" },
  { value: "ROOMS", label: "Rooms" },
  { value: "TIME_SLOTS", label: "Time slots" },
  { value: "SCHEDULES", label: "Schedules" },
  { value: "SETTINGS", label: "Settings" },
  { value: "OTHER", label: "Other" },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<AuditCategory, string>;

const OUTCOMES: Array<{ value: AuditOutcome; label: string; className: string }> = [
  { value: "SUCCESS", label: "Done", className: "border-success/30 text-success" },
  { value: "FAILURE", label: "Failed", className: "border-warning/30 text-warning" },
  { value: "DENIED", label: "Refused", className: "border-destructive/30 text-destructive" },
];
const OUTCOME = Object.fromEntries(OUTCOMES.map((o) => [o.value, o])) as Record<AuditOutcome, (typeof OUTCOMES)[number]>;

/** Local calendar day → start of that day as an instant; `nextDay` gives the exclusive end. */
function dayToIso(day: string, nextDay = false): string | undefined {
  if (!day) {
    return undefined;
  }
  const date = new Date(`${day}T00:00:00`);
  if (nextDay) {
    date.setDate(date.getDate() + 1);
  }
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default function Activity() {
  const [category, setCategory] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<string>(ALL);
  const [actor, setActor] = useState("");
  const [text, setText] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Typing does not fire a request per key press.
  const deferredActor = useDeferredValue(actor.trim());
  const deferredText = useDeferredValue(text.trim());

  const filters: AuditQuery = {
    category: category === ALL ? undefined : (category as AuditCategory),
    outcome: outcome === ALL ? undefined : (outcome as AuditOutcome),
    actor: deferredActor || undefined,
    q: deferredText || undefined,
    from: dayToIso(fromDay),
    to: dayToIso(toDay, true),
  };
  const query: AuditQuery = { ...filters, page, size: PAGE_SIZE };

  const eventsQuery = useQuery({
    queryKey: ["audit", query],
    queryFn: async () => unwrapServiceResponse(await auditService.getEvents(query)),
    placeholderData: (previous) => previous,
  });

  const hasFilters = category !== ALL || outcome !== ALL || actor || text || fromDay || toDay;

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  function clearFilters() {
    setCategory(ALL);
    setOutcome(ALL);
    setActor("");
    setText("");
    setFromDay("");
    setToDay("");
    setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      unwrapServiceResponse(await auditService.exportCsv(filters));
    } catch (error) {
      showErrorToast(error, { title: "Could not export the activity log." });
    } finally {
      setExporting(false);
    }
  }

  const data = eventsQuery.data;
  const events = data?.items ?? [];

  return (
    <AppLayout
      title="Activity"
      subtitle="Who did what, and when. Entries cannot be edited or deleted."
      actions={
        <Button variant="outline" className="gap-2" disabled={exporting} onClick={() => void exportCsv()}>
          {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card md:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label htmlFor="activity-category">Type</Label>
          <Select value={category} onValueChange={change(setCategory)}>
            <SelectTrigger id="activity-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everything</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="activity-outcome">Result</Label>
          <Select value={outcome} onValueChange={change(setOutcome)}>
            <SelectTrigger id="activity-outcome"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any</SelectItem>
              {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="activity-actor">User email</Label>
          <Input id="activity-actor" placeholder="e.g. sara@" value={actor} onChange={(event) => change(setActor)(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="activity-text">Contains</Label>
          <Input id="activity-text" placeholder="e.g. Hall A" value={text} onChange={(event) => change(setText)(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="activity-from">From</Label>
          <Input id="activity-from" type="date" value={fromDay} onChange={(event) => change(setFromDay)(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="activity-to">To</Label>
          <Input id="activity-to" type="date" value={toDay} onChange={(event) => change(setToDay)(event.target.value)} />
        </div>
        {hasFilters && (
          <div className="md:col-span-3 xl:col-span-6">
            <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>
          </div>
        )}
      </div>

      {eventsQuery.isLoading ? (
        <LoadingState title="Loading activity..." description="Fetching the activity log." />
      ) : eventsQuery.isError ? (
        <ErrorState description={getErrorMessage(eventsQuery.error)} onRetry={() => void eventsQuery.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState title="No activity found" description={hasFilters ? "Nothing matches these filters." : "Nothing has been recorded yet."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">What happened</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">IP address</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event: AuditEvent) => (
                <tr key={event.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{event.actorEmail ?? <span className="text-muted-foreground">system</span>}</td>
                  <td className="px-4 py-3">
                    <div>{event.summary}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABEL[event.category] ?? event.category}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={OUTCOME[event.outcome]?.className}>{OUTCOME[event.outcome]?.label ?? event.outcome}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{event.ipAddress ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>{data?.totalItems ?? 0} entries · page {(data?.page ?? 0) + 1} of {Math.max(1, data?.totalPages ?? 1)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0 || eventsQuery.isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Newer
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= (data?.totalPages ?? 1) || eventsQuery.isFetching} onClick={() => setPage((p) => p + 1)}>
                Older <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
