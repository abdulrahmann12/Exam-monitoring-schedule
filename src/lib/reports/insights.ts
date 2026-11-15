import type { Assignment, PersonWorkload } from "@/api";

/** Hour bands for "how is the work spread": nobody / a little / … / a lot. */
export const HOUR_BANDS = [
  { label: "0 h", test: (hours: number) => hours === 0 },
  { label: "up to 3 h", test: (hours: number) => hours > 0 && hours <= 3 },
  { label: "3–6 h", test: (hours: number) => hours > 3 && hours <= 6 },
  { label: "6–9 h", test: (hours: number) => hours > 6 && hours <= 9 },
  { label: "9–12 h", test: (hours: number) => hours > 9 && hours <= 12 },
  { label: "over 12 h", test: (hours: number) => hours > 12 },
] as const;

export function hoursDistribution(people: Pick<PersonWorkload, "hours">[]): Array<{ band: string; people: number }> {
  return HOUR_BANDS.map((band) => ({ band: band.label, people: people.filter((person) => band.test(person.hours)).length }));
}

/**
 * Share of all hours worked by the busiest part of the staff, e.g. "the busiest 10% do 60% of the hours".
 * The busiest group is at least one person. Null when nobody has hours yet.
 */
export function topShare(people: Pick<PersonWorkload, "hours">[], fraction = 0.1): { people: number; percent: number } | null {
  const total = people.reduce((sum, person) => sum + person.hours, 0);
  if (people.length === 0 || total <= 0) return null;
  const count = Math.max(1, Math.round(people.length * fraction));
  const busiest = [...people].sort((a, b) => b.hours - a.hours).slice(0, count);
  const hours = busiest.reduce((sum, person) => sum + person.hours, 0);
  return { people: count, percent: Math.round((hours / total) * 100) };
}

/** Exam rooms per exam day, and how many of them still need staff. */
export function examsPerDay(assignments: Assignment[]): Array<{ date: string; rooms: number; needStaff: number }> {
  const byDay = new Map<string, { rooms: number; needStaff: number }>();
  for (const assignment of assignments) {
    const day = byDay.get(assignment.examDate) ?? { rooms: 0, needStaff: 0 };
    day.rooms += 1;
    const missingSeat = assignment.invigilators.some((seat) => seat.required && !seat.invigilatorId);
    if (!assignment.chiefInvigilatorId || missingSeat) day.needStaff += 1;
    byDay.set(assignment.examDate, day);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => ({ date, ...day }));
}

/** "12.5" / "3" — hours without a pointless ".0". */
/** 4.75 → "4 h 45 min", 3 → "3 h", 0.5 → "30 min", 0 → "0 h": easier to read than a decimal. */
export function formatDuration(hours: number): string {
  const total = Math.round(Number(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m > 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "13 as chief", "4 as invigilator", "2 as chief · 3 as invigilator" or "—". */
export function roomsCovered(asChief: number, asInvigilator: number): string {
  const parts = [asChief > 0 ? `${asChief} as chief` : "", asInvigilator > 0 ? `${asInvigilator} as invigilator` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatHours(value: number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
