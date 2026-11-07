import {
  ArrowRight, CalendarCheck2, CalendarClock, Check, CircleCheck, Clock3, DoorOpen, ListOrdered, TriangleAlert, UserCog, Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Assignment } from "@/api";
import { ErrorState, LoadingState } from "@/components/app/PageState";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { StatCard } from "@/components/uniguard/StatCard";
import { Button } from "@/components/ui/button";
import { useAssignmentsQuery, usePeopleQuery, usePermissions, useRoomsQuery, useTimeSlotsQuery } from "@/hooks";
import { busiestDay, coverageGaps, formatDay, relativeDay, shortTime, upcomingAssignments } from "@/lib/dashboard/insights";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage } from "@/utils/error";

const SUBTITLE = "An at-a-glance view of the selected exam period. People and rooms are shared.";

export default function Dashboard() {
  const { error: groupError, isLoading: groupsLoading, refetch: refetchGroups, activeGroup } = useScheduleGroup();
  const { canEdit } = usePermissions();
  const peopleQuery = usePeopleQuery();
  const roomsQuery = useRoomsQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const timeSlotsQuery = useTimeSlotsQuery({ page: 0, size: 20, sortBy: "sortOrder", direction: "ASC", activeOnly: true });

  if (groupError) {
    return (
      <AppLayout title="Dashboard" subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(groupError)} onRetry={() => void refetchGroups()} />
      </AppLayout>
    );
  }

  if (groupsLoading || peopleQuery.isLoading || roomsQuery.isLoading || assignmentsQuery.isPending || timeSlotsQuery.isPending) {
    return (
      <AppLayout title="Dashboard" subtitle={SUBTITLE}>
        <LoadingState title="Loading dashboard..." description="Collecting staffing, rooms, assignments, and time-slot metrics." />
      </AppLayout>
    );
  }

  const error = peopleQuery.error ?? roomsQuery.error ?? assignmentsQuery.error ?? timeSlotsQuery.error;
  if (peopleQuery.isError || roomsQuery.isError || assignmentsQuery.isError || timeSlotsQuery.isError) {
    return (
      <AppLayout title="Dashboard" subtitle={SUBTITLE}>
        <ErrorState
          description={getErrorMessage(error)}
          onRetry={() => {
            void peopleQuery.refetch();
            void roomsQuery.refetch();
            void assignmentsQuery.refetch();
            void timeSlotsQuery.refetch();
          }}
        />
      </AppLayout>
    );
  }

  const people = peopleQuery.data?.items ?? [];
  const rooms = roomsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const timeSlots = timeSlotsQuery.data?.items ?? [];
  const totalAssignments = assignmentsQuery.data?.totalItems ?? assignments.length;
  const chiefs = people.filter((person) => person.role === "CHIEF_INVIGILATOR");
  const invigilators = people.filter((person) => person.role === "INVIGILATOR");
  const topAssigned = [...people].filter((person) => person.totalAssignments > 0).sort((a, b) => b.totalAssignments - a.totalAssignments).slice(0, 5);
  const gaps = coverageGaps(assignments);
  const upcoming = upcomingAssignments(assignments);
  const peak = busiestDay(assignments);

  const setupSteps = [
    { done: rooms.length > 0, title: "Add exam rooms", hint: "Halls and labs with their invigilator needs", to: "/rooms" },
    { done: chiefs.length > 0 && invigilators.length > 0, title: "Add people", hint: "Chief invigilators and invigilators", to: "/people" },
    { done: timeSlots.length > 0, title: "Set time slots", hint: "For example Morning 09:00 – 11:00", to: "/time-slots" },
    { done: totalAssignments > 0, title: "Create the schedule", hint: "Assign staff to rooms, or auto-assign", to: "/assignments" },
  ];
  const setupDone = setupSteps.every((step) => step.done);

  return (
    <AppLayout
      title="Dashboard"
      subtitle={activeGroup ? `${activeGroup.name} · people and rooms are shared across exam periods.` : SUBTITLE}
      actions={
        <Button asChild className="gap-2 shadow-elevated">
          <Link to="/assignments"><ListOrdered className="h-4 w-4" /> Open assignments</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={UserCog} tone="doctor" label="Chief invigilators" value={chiefs.length} hint={`${chiefs.filter((person) => person.availableDays.length >= 5).length} highly available`} />
          <StatCard icon={Users} tone="ta" label="Invigilators" value={invigilators.length} hint={`${invigilators.filter((person) => person.availableDays.length >= 4).length} broad coverage`} />
          <StatCard icon={DoorOpen} tone="primary" label="Exam rooms" value={rooms.length} hint={`${rooms.reduce((sum, room) => sum + room.minInvigilators, 0)} invigilator places needed`} />
          <StatCard
            icon={CalendarCheck2}
            tone="warning"
            label="Room assignments"
            value={totalAssignments}
            hint={totalAssignments === 0 ? "None yet in this period" : gaps.length > 0 ? `${gaps.length} need staff` : "All fully staffed"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {!setupDone ? (
            <Panel title="Get started" description={`${setupSteps.filter((step) => step.done).length} of ${setupSteps.length} done. Each step unlocks the next.`}>
              <ol className="space-y-2">
                {setupSteps.map((step, index) => (
                  <li key={step.title}>
                    <Link
                      to={step.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border p-3 transition-colors",
                        step.done ? "border-border/60 bg-muted/30" : "border-border hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      <span className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        step.done ? "bg-success text-success-foreground" : "bg-primary/10 text-primary",
                      )}>
                        {step.done ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-medium", step.done && "text-muted-foreground line-through")}>{step.title}</span>
                        <span className="block text-xs text-muted-foreground">{step.hint}</span>
                      </span>
                      {!step.done && canEdit && <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : (
            <Panel
              title="Needs attention"
              description="Exam rooms missing a chief or required invigilators."
              action={gaps.length > 0 ? <PanelLink to="/assignments">Fix in assignments</PanelLink> : undefined}
            >
              {gaps.length === 0 ? (
                <EmptyNote icon={<CircleCheck className="h-6 w-6" />} tone="success" title="All rooms are fully staffed" text="Every exam room in this period has its chief and required invigilators." />
              ) : (
                <ul className="divide-y divide-border/70">
                  {gaps.slice(0, 6).map(({ assignment, missingChief, missingInvigilators }) => (
                    <li key={assignment.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning"><TriangleAlert className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{assignment.roomName} · {assignment.subjectName || assignment.slotLabel}</div>
                        <div className="text-xs text-muted-foreground">{formatDay(assignment.examDate)} · {shortTime(assignment.startTime)}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {missingChief && <Chip>No chief</Chip>}
                        {missingInvigilators > 0 && <Chip>{missingInvigilators} invigilator{missingInvigilators === 1 ? "" : "s"} missing</Chip>}
                      </div>
                    </li>
                  ))}
                  {gaps.length > 6 && <li className="pt-2.5 text-xs text-muted-foreground">and {gaps.length - 6} more…</li>}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Upcoming exams" description="The next exam rooms in this period." action={upcoming.length > 0 ? <PanelLink to="/timeline">Timeline</PanelLink> : undefined}>
            {upcoming.length === 0 ? (
              <EmptyNote
                icon={<CalendarClock className="h-6 w-6" />}
                tone="muted"
                title={totalAssignments === 0 ? "Nothing scheduled yet" : "No upcoming exams"}
                text={totalAssignments === 0 ? "Exams appear here once rooms are assigned." : "All exams of this period are in the past. Pick another period at the top."}
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((assignment) => <UpcomingRow key={assignment.id} assignment={assignment} />)}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title="Most assigned staff" description="Who carries the most duties this period.">
            {topAssigned.length === 0 ? (
              <EmptyNote icon={<Users className="h-6 w-6" />} tone="muted" title="No duties yet" text="Workload shows here once staff are assigned to rooms." />
            ) : (
              <ul className="space-y-3">
                {topAssigned.map((person) => {
                  const max = topAssigned[0].totalAssignments || 1;
                  const chief = person.role === "CHIEF_INVIGILATOR";
                  return (
                    <li key={person.id} className="flex items-center gap-3">
                      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", chief ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>
                        {person.name.replace(/^Dr\.\s*/, "").split(" ").map((segment) => segment[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium">{person.name}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{person.totalAssignments}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", chief ? "bg-chief" : "bg-invigilator")} style={{ width: `${(person.totalAssignments / max) * 100}%` }} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{chief ? "Chief invigilator" : "Invigilator"}{person.department ? ` · ${person.department}` : ""}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Period at a glance">
            <dl className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Busiest day</dt>
                  <dd className="font-medium">{peak ? `${formatDay(peak.date, { weekday: "long", day: "numeric", month: "long" })} · ${peak.rooms} rooms` : "Not scheduled yet"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Time slots ({timeSlots.length})</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {timeSlots.length === 0 ? <span className="text-muted-foreground">None yet</span> : timeSlots.map((slot) => (
                      <span key={slot.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">{slot.label}</span>
                    ))}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TriangleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", gaps.length > 0 ? "text-warning" : "text-muted-foreground")} />
                <div>
                  <dt className="text-xs text-muted-foreground">Staffing gaps</dt>
                  <dd className="font-medium">{gaps.length === 0 ? "None" : `${gaps.length} room${gaps.length === 1 ? "" : "s"}`}</dd>
                </div>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}

function UpcomingRow({ assignment }: { assignment: Assignment }) {
  const relative = relativeDay(assignment.examDate);
  const day = assignment.examDate.split("-")[2];
  const staffed = Boolean(assignment.chiefInvigilatorId) && assignment.invigilators.every((slot) => !slot.required || slot.invigilatorId);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/70 p-2.5">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg text-center leading-none", relative === "Today" ? "bg-primary text-primary-foreground" : "bg-muted")}>
        <div>
          <div className="text-base font-bold">{Number(day)}</div>
          <div className="mt-0.5 text-[10px] uppercase opacity-70">{formatDay(assignment.examDate, { month: "short" })}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{assignment.subjectName || assignment.subjectCode || "Exam"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {relative ? `${relative} · ` : ""}{shortTime(assignment.startTime)}–{shortTime(assignment.endTime)} · {assignment.roomName}
        </div>
      </div>
      {staffed
        ? <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Staffed</span>
        : <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">Needs staff</span>}
    </li>
  );
}

function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <h3 className="text-display font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 text-xs">
      <Link to={to}>{children} <ArrowRight className="h-3.5 w-3.5" /></Link>
    </Button>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">{children}</span>;
}

function EmptyNote({ icon, title, text, tone }: { icon: ReactNode; title: string; text: string; tone: "success" | "muted" }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className={cn("grid h-12 w-12 place-items-center rounded-full", tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{icon}</div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-0.5 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
