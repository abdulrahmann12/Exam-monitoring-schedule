/** Small helpers for showing time slots: "09:00", lengths, overlaps and time order. */

export interface SlotTimes {
  id: string;
  label?: string | null;
  startTime: string;
  endTime: string;
}

/** "09:00" from "09:00:00" (or "09:00"). */
export function hhmm(value: string): string {
  return value.slice(0, 5);
}

/** Minutes since midnight. */
export function minutesOf(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** "1 h 30 min", "3 h", "45 min". */
export function durationLabel(start: string, end: string): string {
  const total = Math.max(0, minutesOf(end) - minutesOf(start));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** Other slots whose time window overlaps this one (touching end-to-start is not an overlap). */
export function overlapping<T extends SlotTimes>(slot: SlotTimes, others: T[]): T[] {
  const start = minutesOf(slot.startTime);
  const end = minutesOf(slot.endTime);
  return others.filter((other) => other.id !== slot.id && minutesOf(other.startTime) < end && start < minutesOf(other.endTime));
}

/** By start time, then end time, then name. */
export function byStartTime<T extends SlotTimes>(a: T, b: T): number {
  return minutesOf(a.startTime) - minutesOf(b.startTime)
    || minutesOf(a.endTime) - minutesOf(b.endTime)
    || (a.label ?? "").localeCompare(b.label ?? "");
}

/** Hours to draw on a day bar: from the earliest start to the latest end, rounded out to whole hours. */
export function dayRange(slots: SlotTimes[]): { from: number; to: number } {
  if (slots.length === 0) return { from: 8 * 60, to: 18 * 60 };
  const from = Math.floor(Math.min(...slots.map((slot) => minutesOf(slot.startTime))) / 60) * 60;
  const to = Math.ceil(Math.max(...slots.map((slot) => minutesOf(slot.endTime))) / 60) * 60;
  return { from, to: Math.max(to, from + 60) };
}
