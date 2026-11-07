import type { Assignment } from "@/api";

/** What is missing in one exam room: the chief, and/or some required invigilators. */
export interface CoverageGap {
  assignment: Assignment;
  missingChief: boolean;
  missingInvigilators: number;
}

export function coverageGaps(assignments: Assignment[]): CoverageGap[] {
  return assignments
    .map((assignment) => ({
      assignment,
      missingChief: !assignment.chiefInvigilatorId,
      missingInvigilators: assignment.invigilators.filter((slot) => slot.required && !slot.invigilatorId).length,
    }))
    .filter((gap) => gap.missingChief || gap.missingInvigilators > 0)
    .sort((a, b) => compareAssignments(a.assignment, b.assignment));
}

export function compareAssignments(a: Assignment, b: Assignment): number {
  return a.examDate.localeCompare(b.examDate) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.roomName.localeCompare(b.roomName);
}

/** "YYYY-MM-DD" of a local date (not UTC: exams are planned in local days). */
export function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Exams from today on, soonest first. */
export function upcomingAssignments(assignments: Assignment[], today = new Date(), limit = 6): Assignment[] {
  const from = isoDay(today);
  return assignments.filter((assignment) => assignment.examDate >= from).sort(compareAssignments).slice(0, limit);
}

export function busiestDay(assignments: Assignment[]): { date: string; rooms: number } | null {
  const perDay = new Map<string, number>();
  for (const assignment of assignments) perDay.set(assignment.examDate, (perDay.get(assignment.examDate) ?? 0) + 1);
  let best: { date: string; rooms: number } | null = null;
  for (const [date, rooms] of perDay) {
    if (!best || rooms > best.rooms || (rooms === best.rooms && date < best.date)) best = { date, rooms };
  }
  return best;
}

/** "Mon 9 Nov" from "2026-11-09", read as a local day. */
export function formatDay(value: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}

export function relativeDay(value: string, today = new Date()): string | null {
  const todayIso = isoDay(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (value === todayIso) return "Today";
  if (value === isoDay(tomorrow)) return "Tomorrow";
  return null;
}

/** "09:00" from "09:00:00". */
export function shortTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}
