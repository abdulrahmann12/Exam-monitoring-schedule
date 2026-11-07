import {
  Building2, ChevronLeft, ChevronRight, CircleX, KeyRound, LogIn, RefreshCw, Search, Settings2, ShieldAlert, Users, type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AuditCategory, AuditEvent } from "@/api";
import { ErrorState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerActivityQuery } from "@/hooks";
import { relativeTime } from "@/lib/owner/insights";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";

import { PageHeader } from "./OwnerUi";

const PAGE_SIZE = 50;

const CATEGORY_ICONS: Partial<Record<AuditCategory, LucideIcon>> = {
  AUTH: LogIn,
  SECURITY: KeyRound,
  USERS: Users,
  PLATFORM: Building2,
  SETTINGS: Settings2,
};

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  AUTH: "Sign-in",
  SECURITY: "Security",
  USERS: "Users",
  PEOPLE: "Staff",
  ROOMS: "Rooms",
  TIME_SLOTS: "Time slots",
  SCHEDULES: "Schedules",
  SETTINGS: "Settings",
  PLATFORM: "Universities",
  OTHER: "Other",
};

export function ActivityItem({ event, compact = false }: { event: AuditEvent; compact?: boolean }) {
  const failed = event.outcome !== "SUCCESS";
  const Icon = failed ? (event.outcome === "DENIED" ? ShieldAlert : CircleX) : CATEGORY_ICONS[event.category] ?? Settings2;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", failed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={cn("text-sm", failed && "text-destructive")}>{event.summary}</p>
          <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={event.occurredAt} title={new Date(event.occurredAt).toLocaleString()}>
            {compact ? relativeTime(event.occurredAt) : new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
        {!compact && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {CATEGORY_LABELS[event.category] ?? event.category}
            {event.actorEmail ? ` · ${event.actorEmail}` : ""}
            {event.ipAddress ? ` · ${event.ipAddress}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function OwnerActivity() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | AuditCategory>("ALL");
  const [outcome, setOutcome] = useState<"ALL" | "SUCCESS" | "PROBLEM">("ALL");
  const query = useOwnerActivityQuery(page, PAGE_SIZE);
  const data = query.data;

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const items = (data?.items ?? []).filter((event) => {
      if (category !== "ALL" && event.category !== category) return false;
      if (outcome === "SUCCESS" && event.outcome !== "SUCCESS") return false;
      if (outcome === "PROBLEM" && event.outcome === "SUCCESS") return false;
      if (!needle) return true;
      return [event.summary, event.actorEmail, event.ipAddress, event.action].some((value) => (value ?? "").toLowerCase().includes(needle));
    });
    const byDay = new Map<string, AuditEvent[]>();
    for (const event of items) {
      const key = dayLabel(event.occurredAt);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
    return [...byDay.entries()];
  }, [data, search, category, outcome]);

  const categories = useMemo(() => [...new Set((data?.items ?? []).map((event) => event.category))], [data]);
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const filtered = search.trim() !== "" || category !== "ALL" || outcome !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Your own actions and sign-ins as the owner. Each university's activity log is visible only to its administrators."
        actions={
          <Button variant="outline" className="gap-2" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page: text, email or IP" className="pl-9" aria-label="Search activity" />
        </div>
        <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
          <SelectTrigger className="sm:w-44" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABELS[value] ?? value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={(value) => setOutcome(value as typeof outcome)}>
          <SelectTrigger className="sm:w-40" aria-label="Result"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All results</SelectItem>
            <SelectItem value="SUCCESS">Succeeded</SelectItem>
            <SelectItem value="PROBLEM">Failed or denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <p className="font-medium">{filtered ? "Nothing matches these filters" : "No activity yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{filtered ? "Try another search or clear the filters." : "Your sign-ins and changes will appear here."}</p>
          {filtered && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setCategory("ALL"); setOutcome("ALL"); }}>Clear filters</Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, events]) => (
            <section key={day} className="rounded-2xl border border-border bg-card shadow-card">
              <h2 className="border-b border-border/70 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h2>
              <ul className="divide-y divide-border/60 px-5 py-4">
                {events.map((event) => <ActivityItem key={event.id} event={event} />)}
              </ul>
            </section>
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} · {data.totalItems.toLocaleString()} events
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" disabled={page === 0 || query.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              <ChevronLeft className="h-4 w-4" /> Newer
            </Button>
            <Button variant="outline" size="sm" className="gap-1" disabled={page + 1 >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)}>
              Older <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
