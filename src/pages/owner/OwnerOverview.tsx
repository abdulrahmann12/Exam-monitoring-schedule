import { ArrowRight, Building2, CalendarCheck, CircleCheck, Plus, ShieldCheck, Users, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";

import { ErrorState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerActivityQuery, useOwnerOverviewQuery } from "@/hooks";
import { relativeTime, securitySummary, universityIssues } from "@/lib/owner/insights";
import { useAuth } from "@/state/auth";
import { getErrorMessage } from "@/utils/error";

import { ActivityItem } from "./OwnerActivity";
import { IssueChips, KpiCard, KpiSkeleton, PageHeader, Panel, UniversityAvatar } from "./OwnerUi";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export default function OwnerOverview() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const overviewQuery = useOwnerOverviewQuery();
  const activityQuery = useOwnerActivityQuery(0, 50);
  const overview = overviewQuery.data;

  const attention = useMemo(
    () => (overview?.universities ?? [])
      .map((university) => ({ university, issues: universityIssues(university) }))
      .filter((entry) => entry.issues.length > 0),
    [overview],
  );
  const security = useMemo(() => securitySummary(overview?.universities ?? []), [overview]);
  const ranking = useMemo(
    () => [...(overview?.universities ?? [])].filter((university) => university.active).sort((a, b) => b.scheduledExamRooms - a.scheduledExamRooms).slice(0, 5),
    [overview],
  );

  // Back from linking Microsoft / Google: that card lives on the account page.
  if (searchParams.has("sso") || searchParams.has("sso_error")) {
    return <Navigate to={`/owner/account${location.search}`} replace />;
  }

  const maxExams = Math.max(1, ...ranking.map((university) => university.scheduledExamRooms));
  const firstName = (user?.displayName || "").split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · Here is how the platform is doing."}
        actions={
          <Button asChild className="gap-2">
            <Link to="/owner/universities?new=1"><Plus className="h-4 w-4" /> New university</Link>
          </Button>
        }
      />

      {overviewQuery.isError ? (
        <ErrorState description={getErrorMessage(overviewQuery.error)} onRetry={() => void overviewQuery.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Totals">
            {!overview ? (
              Array.from({ length: 4 }, (_, index) => <KpiSkeleton key={index} />)
            ) : (
              <>
                <KpiCard
                  icon={Building2}
                  label="Universities"
                  value={overview.totals.universities}
                  hint={<><span className="font-medium text-success">{overview.totals.activeUniversities} active</span>{overview.totals.universities - overview.totals.activeUniversities > 0 ? ` · ${overview.totals.universities - overview.totals.activeUniversities} switched off` : ""}</>}
                />
                <KpiCard icon={Users} tone="violet" label="User accounts" value={overview.totals.accounts} hint="Admins, schedulers and viewers" />
                <KpiCard icon={UsersRound} tone="success" label="Staff (people)" value={overview.totals.people} hint="Invigilators across all universities" />
                <KpiCard icon={CalendarCheck} tone="warning" label="Scheduled exam rooms" value={overview.totals.scheduledExamRooms} hint="Room slots with invigilators" />
              </>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Needs attention"
              description="Active universities with a setup or security gap."
              action={attention.length > 0 ? (
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                  <Link to="/owner/universities?filter=attention">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              ) : undefined}
            >
              {!overview ? (
                <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
              ) : attention.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><CircleCheck className="h-6 w-6" /></div>
                  <p className="mt-3 font-medium">All good</p>
                  <p className="text-sm text-muted-foreground">Every active university has a signed-in, protected administrator.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {attention.slice(0, 6).map(({ university, issues }) => (
                    <li key={university.id}>
                      <Link to={`/owner/universities?open=${university.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50">
                        <UniversityAvatar university={university} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{university.name}</div>
                          <IssueChips issues={issues} className="mt-1" />
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Administrator security" description="Across all universities.">
              {!overview ? (
                <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div>
                    <div>
                      <div className="font-display text-3xl font-bold tabular-nums">{percent(security.withTwoFactor, security.signedIn)}%</div>
                      <div className="text-xs text-muted-foreground">of signed-in admins use two-step sign-in</div>
                    </div>
                  </div>
                  <Meter label="Signed in" value={security.signedIn} total={security.admins} />
                  <Meter label="Two-step sign-in on" value={security.withTwoFactor} total={security.signedIn} />
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <div className="text-lg font-semibold tabular-nums">{security.waiting}</div>
                      <div className="text-[11px] text-muted-foreground">Invitations waiting</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <div className="text-lg font-semibold tabular-nums">{security.disabled}</div>
                      <div className="text-[11px] text-muted-foreground">Disabled admins</div>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Most active universities" description="By exam rooms scheduled.">
              {!overview ? (
                <div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
              ) : ranking.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No active universities yet.</p>
              ) : (
                <ol className="space-y-4">
                  {ranking.map((university, index) => (
                    <li key={university.id}>
                      <Link to={`/owner/universities?open=${university.id}`} className="group block">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-4 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                            <span className="truncate font-medium group-hover:text-primary">{university.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{university.scheduledExamRooms.toLocaleString()}</span>
                        </div>
                        <div className="ml-6 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-hero transition-all" style={{ width: `${Math.max(2, (university.scheduledExamRooms / maxExams) * 100)}%` }} />
                        </div>
                        <div className="ml-6 mt-1 text-[11px] text-muted-foreground">
                          {university.accounts} accounts · {university.people} staff · active {relativeTime(university.lastActivityAt ?? university.lastSignInAt)}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel
              title="Recent activity"
              description="Your latest actions and sign-ins."
              action={
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                  <Link to="/owner/activity">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              }
            >
              {activityQuery.isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
              ) : activityQuery.isError ? (
                <p className="text-sm text-destructive">{getErrorMessage(activityQuery.error)}</p>
              ) : (activityQuery.data?.items.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {activityQuery.data?.items.slice(0, 6).map((event) => <ActivityItem key={event.id} event={event} compact />)}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value} / {total}</span>
      </div>
      <Progress value={percent(value, total)} className="h-2" aria-label={label} />
    </div>
  );
}
