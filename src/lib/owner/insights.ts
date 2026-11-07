import type { OwnerUniversity, OwnerUniversityAdmin } from "@/api";

/** Things the platform owner should look at. Counts and statuses only, never a university's data. */
export type UniversityIssue = "no-admin" | "admin-waiting" | "admin-no-2fa" | "inactive";

export const ISSUE_LABELS: Record<UniversityIssue, string> = {
  "no-admin": "No administrator",
  "admin-waiting": "Admin has not signed in",
  "admin-no-2fa": "Admin without two-step sign-in",
  inactive: "No activity for 30 days",
};

const DAY = 24 * 60 * 60 * 1000;
export const INACTIVE_AFTER_DAYS = 30;

export type AdminStatus = "active" | "invited" | "waiting" | "disabled";

export function adminStatus(admin: OwnerUniversityAdmin): AdminStatus {
  if (!admin.enabled) return "disabled";
  if (admin.signedIn) return "active";
  return admin.invitationPending ? "invited" : "waiting";
}

/** Issues of an active university (a switched-off one needs nothing until it is switched on). */
export function universityIssues(university: OwnerUniversity, now = Date.now()): UniversityIssue[] {
  if (!university.active) return [];
  const issues: UniversityIssue[] = [];
  const usable = university.admins.filter((admin) => admin.enabled);
  if (usable.length === 0) {
    issues.push("no-admin");
  } else {
    if (usable.some((admin) => !admin.signedIn)) issues.push("admin-waiting");
    if (usable.some((admin) => admin.signedIn && !admin.twoFactorEnabled)) issues.push("admin-no-2fa");
  }
  const last = university.lastActivityAt ?? university.lastSignInAt;
  const since = last ? Date.parse(last) : Date.parse(university.createdAt);
  if (Number.isFinite(since) && now - since > INACTIVE_AFTER_DAYS * DAY) issues.push("inactive");
  return issues;
}

export type UniversityFilter = "all" | "active" | "off" | "attention";
export type UniversitySort = "name" | "recent" | "accounts" | "exams" | "newest";

function lastSeen(university: OwnerUniversity): number {
  const value = university.lastActivityAt ?? university.lastSignInAt;
  return value ? Date.parse(value) : 0;
}

export function filterUniversities(
  universities: OwnerUniversity[],
  { query = "", filter = "all", sort = "name" }: { query?: string; filter?: UniversityFilter; sort?: UniversitySort },
  now = Date.now(),
): OwnerUniversity[] {
  const needle = query.trim().toLowerCase();
  const result = universities.filter((university) => {
    if (filter === "active" && !university.active) return false;
    if (filter === "off" && university.active) return false;
    if (filter === "attention" && universityIssues(university, now).length === 0) return false;
    if (!needle) return true;
    return (
      university.name.toLowerCase().includes(needle) ||
      university.slug.toLowerCase().includes(needle) ||
      university.admins.some((admin) => admin.email.toLowerCase().includes(needle) || (admin.displayName ?? "").toLowerCase().includes(needle))
    );
  });
  const byName = (a: OwnerUniversity, b: OwnerUniversity) => a.name.localeCompare(b.name);
  const sorters: Record<UniversitySort, (a: OwnerUniversity, b: OwnerUniversity) => number> = {
    name: byName,
    recent: (a, b) => lastSeen(b) - lastSeen(a) || byName(a, b),
    accounts: (a, b) => b.accounts - a.accounts || byName(a, b),
    exams: (a, b) => b.scheduledExamRooms - a.scheduledExamRooms || byName(a, b),
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || byName(a, b),
  };
  return [...result].sort(sorters[sort]);
}

export interface SecuritySummary {
  admins: number;
  signedIn: number;
  withTwoFactor: number;
  waiting: number;
  disabled: number;
}

export function securitySummary(universities: OwnerUniversity[]): SecuritySummary {
  const admins = universities.flatMap((university) => university.admins);
  return {
    admins: admins.length,
    signedIn: admins.filter((admin) => admin.enabled && admin.signedIn).length,
    withTwoFactor: admins.filter((admin) => admin.enabled && admin.signedIn && admin.twoFactorEnabled).length,
    waiting: admins.filter((admin) => admin.enabled && !admin.signedIn).length,
    disabled: admins.filter((admin) => !admin.enabled).length,
  };
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "Never";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Never";
  const diff = Math.max(0, now - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(time).toLocaleDateString();
}

/** Two letters for an avatar: "Cairo University" → "CU". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
