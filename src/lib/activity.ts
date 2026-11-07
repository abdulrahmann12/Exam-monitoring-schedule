/** Small helpers for showing activity-log entries. */

/** The local machine shows up as ::1 / 127.0.0.1; that means "this computer", not a real address. */
export function describeIp(ip: string | null): string {
  if (!ip) return "—";
  const compact = ip.replace(/^0:0:0:0:0:0:0:1$/, "::1");
  return compact === "::1" || compact === "127.0.0.1" ? "This computer" : ip;
}

export function dayHeading(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
