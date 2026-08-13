import { AlertTriangle, ArrowRight, CalendarCheck2, Clock3, DoorOpen, ListOrdered, UserCog, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/app/PageState";
import { StatCard } from "@/components/uniguard/StatCard";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { Button } from "@/components/ui/button";
import { useAssignmentsQuery, usePeopleQuery, useRoomsQuery, useTimeSlotsQuery } from "@/hooks";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage } from "@/utils/error";

export default function Dashboard() {
  const { error: groupError, isLoading: groupsLoading, refetch: refetchGroups } = useScheduleGroup();
  const peopleQuery = usePeopleQuery();
  const roomsQuery = useRoomsQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const timeSlotsQuery = useTimeSlotsQuery({ page: 0, size: 20, sortBy: "sortOrder", direction: "ASC", activeOnly: true });

  if (groupError) {
    return (
      <AppLayout title="Dashboard" subtitle="An at-a-glance view of the selected exam period. People and rooms are shared.">
        <ErrorState description={getErrorMessage(groupError)} onRetry={() => void refetchGroups()} />
      </AppLayout>
    );
  }

  if (groupsLoading || peopleQuery.isLoading || roomsQuery.isLoading || assignmentsQuery.isPending || timeSlotsQuery.isPending) {
    return (
      <AppLayout title="Dashboard" subtitle="An at-a-glance view of the selected exam period. People and rooms are shared.">
        <LoadingState title="Loading dashboard..." description="Collecting staffing, rooms, assignments, and time-slot metrics." />
      </AppLayout>
    );
  }

  const error = peopleQuery.error ?? roomsQuery.error ?? assignmentsQuery.error ?? timeSlotsQuery.error;
  if (peopleQuery.isError || roomsQuery.isError || assignmentsQuery.isError || timeSlotsQuery.isError) {
    return (
      <AppLayout title="Dashboard" subtitle="An at-a-glance view of the selected exam period. People and rooms are shared.">
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
  const chiefs = people.filter((person) => person.role === "CHIEF_INVIGILATOR");
  const invigilators = people.filter((person) => person.role === "INVIGILATOR");
  const topAssigned = [...people].sort((left, right) => right.totalAssignments - left.totalAssignments).slice(0, 5);
  const coverageIssues = assignments.filter(
    (assignment) =>
      !assignment.chiefInvigilatorId || assignment.invigilators.some((invigilator) => invigilator.required && !invigilator.invigilatorId),
  ).length;
  const busiestDate = Object.entries(
    assignments.reduce<Record<string, number>>((accumulator, assignment) => {
      accumulator[assignment.examDate] = (accumulator[assignment.examDate] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).sort((left, right) => right[1] - left[1])[0];

  return (
    <AppLayout
      title="Dashboard"
      subtitle="An at-a-glance view of the selected exam period. People and rooms are shared."
      actions={
        <Link to="/assignments">
          <Button className="gap-2 shadow-elevated">
            <ListOrdered className="h-4 w-4" /> Open Assignments
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={UserCog} tone="doctor" label="Chief Invigilators" value={chiefs.length} hint={`${chiefs.filter((person) => person.availableDays.length >= 5).length} highly available`} />
          <StatCard icon={Users} tone="ta" label="Invigilators" value={invigilators.length} hint={`${invigilators.filter((person) => person.availableDays.length >= 4).length} broad coverage`} />
          <StatCard icon={DoorOpen} tone="primary" label="Exam Rooms" value={rooms.length} hint={`${rooms.reduce((sum, room) => sum + room.minInvigilators, 0)} required invigilator slots`} />
          <StatCard icon={CalendarCheck2} tone="warning" label="Assignments" value={assignments.length} hint={coverageIssues > 0 ? `${coverageIssues} assignments need staffing review` : "All assignments staffed"} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-display text-lg font-semibold">Quick actions</h3>
                <p className="text-sm text-muted-foreground">Jump into the main backend-connected workflows.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { to: "/assignments", icon: ListOrdered, title: "Manage assignments", desc: "Create and adjust room coverage by date.", tone: "bg-gradient-hero text-primary-foreground" },
                { to: "/time-slots", icon: Clock3, title: "Configure time slots", desc: "Maintain the reusable exam sessions.", tone: "bg-card border border-border" },
                { to: "/people", icon: Users, title: "Manage people", desc: "Update roles, departments, and availability.", tone: "bg-card border border-border" },
                { to: "/rooms", icon: DoorOpen, title: "Manage rooms", desc: "Set capacities and staffing requirements.", tone: "bg-card border border-border" },
              ].map((item) => (
                <Link key={item.title} to={item.to} className={`group rounded-lg p-4 transition-smooth hover:-translate-y-0.5 hover:shadow-elevated ${item.tone}`}>
                  <div className="flex items-start justify-between">
                    <item.icon className="h-5 w-5" />
                    <ArrowRight className="h-4 w-4 opacity-0 transition-smooth group-hover:opacity-100" />
                  </div>
                  <div className="mt-6">
                    <div className="text-display font-semibold">{item.title}</div>
                    <div className={`mt-1 text-xs ${item.tone.includes("gradient") ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-display text-lg font-semibold">Top assigned</h3>
              <span className="text-xs text-muted-foreground">This period</span>
            </div>
            <ul className="space-y-3">
              {topAssigned.map((person, index) => (
                <li key={person.id} className="flex items-center gap-3">
                  <div className="w-4 text-xs font-mono text-muted-foreground">{index + 1}</div>
                  <div className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold ${person.role === "CHIEF_INVIGILATOR" ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator"}`}>
                    {person.name.replace(/^Dr\.\s*/, "").split(" ").map((segment) => segment[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{person.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {person.role === "CHIEF_INVIGILATOR" ? "Chief Invigilator" : "Invigilator"} · {person.department}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{person.totalAssignments}</div>
                </li>
              ))}
              {topAssigned.every((person) => person.totalAssignments === 0) ? (
                <li className="py-4 text-center text-xs text-muted-foreground">No assignments yet. Create room assignments to see workload trends.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Peak date</div>
            <div className="mt-2 text-2xl font-bold">{busiestDate?.[0] ?? "Not scheduled"}</div>
            <div className="mt-1 text-sm text-muted-foreground">{busiestDate ? `${busiestDate[1]} room assignments on the busiest date.` : "Assignments will surface activity here once created."}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Active time slots</div>
            <div className="mt-2 text-2xl font-bold">{timeSlots.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">{timeSlots.map((slot) => slot.label).join(" · ") || "Create slots to structure exam sessions."}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Coverage review</div>
            <div className="mt-2 text-2xl font-bold">{coverageIssues}</div>
            <div className="mt-1 text-sm text-muted-foreground">Assignments missing a chief or required invigilator.</div>
          </div>
        </div>

        {coverageIssues > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 animate-fade-in">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <div className="text-sm font-medium text-destructive">{coverageIssues} assignments need review</div>
              <div className="text-xs text-destructive/80">Open the assignments page to complete missing staffing and clear coverage gaps.</div>
            </div>
            <Link to="/assignments">
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                Resolve
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
