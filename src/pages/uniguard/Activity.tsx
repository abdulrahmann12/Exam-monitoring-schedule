import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock, DoorOpen, Download, KeyRound, ListChecks, LoaderCircle, LogIn, Search, Settings2, ShieldAlert, ShieldCheck, UserCog, Users, X,
  type LucideIcon,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import type { AuditCategory, AuditEvent, AuditOutcome, AuditQuery } from "@/api";
import { auditService } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { TablePagination } from "@/components/app/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { dayHeading, describeIp } from "@/lib/activity";
import { cn } from "@/lib/utils";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

const ALL = "ALL";

const CATEGORIES: Array<{ value: AuditCategory; label: string; icon: LucideIcon }> = [
  { value: "AUTH", label: "Sign-in & passwords", icon: LogIn },
  { value: "SECURITY", label: "Security", icon: KeyRound },
  { value: "USERS", label: "Users", icon: UserCog },
  { value: "PEOPLE", label: "People", icon: Users },
  { value: "ROOMS", label: "Rooms", icon: DoorOpen },
  { value: "TIME_SLOTS", label: "Time slots", icon: CalendarClock },
  { value: "SCHEDULES", label: "Schedules", icon: ListChecks },
  { value: "SETTINGS", label: "Settings", icon: Settings2 },
  { value: "OTHER", label: "Other", icon: Settings2 },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<AuditCategory, (typeof CATEGORIES)[number]>;

const OUTCOMES: Array<{ value: AuditOutcome; label: string }> = [
  { value: "SUCCESS", label: "Done" },
  { value: "FAILURE", label: "Failed" },
  { value: "DENIED", label: "Refused" },
];

type Range = "all" | "today" | "7d" | "30d" | "custom";
const RANGES: Array<{ value: Range; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom…" },
];

/** Local calendar day → start of that day as an instant; `nextDay` gives the exclusive end. */
function dayToIso(day: string, nextDay = false): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function startOfDaysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export default function Activity() {
  const [category, setCategory] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<string>(ALL);
  const [actor, setActor] = useState("");
  const [text, setText] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);

  // Typing does not fire a request per key press.
  const deferredActor = useDeferredValue(actor.trim());
  const deferredText = useDeferredValue(text.trim());

  const { from, to } = useMemo(() => {
    if (range === "today") return { from: startOfDaysAgo(0), to: undefined };
    if (range === "7d") return { from: startOfDaysAgo(6), to: undefined };
    if (range === "30d") return { from: startOfDaysAgo(29), to: undefined };
    if (range === "custom") return { from: dayToIso(fromDay), to: dayToIso(toDay, true) };
    return { from: undefined, to: undefined };
  }, [range, fromDay, toDay]);

  const filters: AuditQuery = {
    category: category === ALL ? undefined : (category as AuditCategory),
    outcome: outcome === ALL ? undefined : (outcome as AuditOutcome),
    actor: deferredActor || undefined,
    q: deferredText || undefined,
    from,
    to,
  };
  const query: AuditQuery = { ...filters, page, size: pageSize };

  const eventsQuery = useQuery({
    queryKey: ["audit", query],
    queryFn: async () => unwrapServiceResponse(await auditService.getEvents(query)),
    placeholderData: (previous) => previous,
  });

  // Security summary: problems in the last 7 days (two tiny counts, no rows).
  const weekAgo = useMemo(() => startOfDaysAgo(6), []);
  const failedQuery = useQuery({
    queryKey: ["audit", "count", "FAILURE", weekAgo],
    queryFn: async () => unwrapServiceResponse(await auditService.getEvents({ outcome: "FAILURE", from: weekAgo, page: 0, size: 1 })),
  });
  const deniedQuery = useQuery({
    queryKey: ["audit", "count", "DENIED", weekAgo],
    queryFn: async () => unwrapServiceResponse(await auditService.getEvents({ outcome: "DENIED", from: weekAgo, page: 0, size: 1 })),
  });

  const hasFilters = category !== ALL || outcome !== ALL || actor !== "" || text !== "" || range !== "all";

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
    setRange("all");
    setFromDay("");
    setToDay("");
    setPage(0);
  }

  function showProblems(kind: AuditOutcome) {
    clearFilters();
    setOutcome(kind);
    setRange("7d");
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
  const groups = useMemo(() => {
    const byDay = new Map<string, AuditEvent[]>();
    for (const event of data?.items ?? []) {
      const key = dayHeading(event.occurredAt);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
    return [...byDay.entries()];
  }, [data]);

  const failed = failedQuery.data?.totalItems ?? 0;
  const denied = deniedQuery.data?.totalItems ?? 0;

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
      <div className="space-y-4">
        {(failedQuery.isSuccess && deniedQuery.isSuccess) && (
          failed + denied === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
              <span>No failed or refused actions in the last 7 days.</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
              <span className="flex-1">
                Last 7 days: <span className="font-semibold">{failed}</span> failed and <span className="font-semibold">{denied}</span> refused action{failed + denied === 1 ? "" : "s"}
                <span className="text-muted-foreground"> (for example wrong passwords or blocked requests)</span>.
              </span>
              <div className="flex gap-2">
                {failed > 0 && <Button size="sm" variant="outline" onClick={() => showProblems("FAILURE")}>Show failed</Button>}
                {denied > 0 && <Button size="sm" variant="outline" onClick={() => showProblems("DENIED")}>Show refused</Button>}
              </div>
            </div>
          )
        )}

        <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={text} onChange={(event) => change(setText)(event.target.value)} placeholder="Search what happened, e.g. Hall A" className="h-10 pl-9" aria-label="Search what happened" />
            </div>
            <Input value={actor} onChange={(event) => change(setActor)(event.target.value)} placeholder="User email" className="h-10 lg:w-56" aria-label="User email" />
            <Select value={category} onValueChange={change(setCategory)}>
              <SelectTrigger className="h-10 lg:w-48" aria-label="Type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={outcome} onValueChange={change(setOutcome)}>
              <SelectTrigger className="h-10 lg:w-40" aria-label="Result"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any result</SelectItem>
                {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="When">
              {RANGES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={range === option.value}
                  onClick={() => change(setRange)(option.value)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", range === option.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Input type="date" value={fromDay} max={toDay || undefined} onChange={(event) => change(setFromDay)(event.target.value)} className="h-8 w-36" aria-label="From" />
                to
                <Input type="date" value={toDay} min={fromDay || undefined} onChange={(event) => change(setToDay)(event.target.value)} className="h-8 w-36" aria-label="To" />
              </div>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>
            )}
          </div>
        </div>

        {eventsQuery.isLoading ? (
          <LoadingState title="Loading activity..." />
        ) : eventsQuery.isError ? (
          <ErrorState description={getErrorMessage(eventsQuery.error)} onRetry={() => void eventsQuery.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nothing matches" : "No activity yet"}
            description={hasFilters ? "Try other filters." : "Sign-ins and changes will appear here."}
            action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-card", eventsQuery.isFetching && "opacity-70")}>
            {groups.map(([day, events]) => (
              <section key={day}>
                <h2 className="sticky top-0 z-[1] border-b border-border bg-muted/60 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{day}</h2>
                <ul className="divide-y divide-border/70">
                  {events.map((event) => <EventRow key={event.id} event={event} onActor={(email) => { change(setActor)(email); }} />)}
                </ul>
              </section>
            ))}
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={data?.totalItems ?? 0}
              noun="entries"
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EventRow({ event, onActor }: { event: AuditEvent; onActor: (email: string) => void }) {
  const meta = CATEGORY[event.category] ?? CATEGORY.OTHER;
  const problem = event.outcome !== "SUCCESS";
  const Icon = problem ? ShieldAlert : meta.icon;
  return (
    <li className={cn("flex gap-3 px-5 py-3", problem && "bg-destructive/[0.03]")}>
      <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", problem ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-sm">
            {event.summary}
            {problem && (
              <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium", event.outcome === "DENIED" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning")}>
                {event.outcome === "DENIED" ? "Refused" : "Failed"}
              </span>
            )}
          </p>
          <time className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" dateTime={event.occurredAt} title={new Date(event.occurredAt).toLocaleString()}>
            {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.actorEmail
            ? <button type="button" className="hover:text-foreground hover:underline" title="Show only this user" onClick={() => onActor(event.actorEmail ?? "")}>{event.actorEmail}</button>
            : "Unknown user"}
          {" · "}{meta.label}{" · "}<span title={event.ipAddress ?? undefined}>{describeIp(event.ipAddress)}</span>
        </p>
      </div>
    </li>
  );
}
