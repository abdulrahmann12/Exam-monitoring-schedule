import { describe, expect, it } from "vitest";

import type { OwnerUniversity, OwnerUniversityAdmin } from "@/api";

import { adminStatus, filterUniversities, initials, relativeTime, securitySummary, universityIssues } from "./insights";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86400000).toISOString();

function admin(overrides: Partial<OwnerUniversityAdmin> = {}): OwnerUniversityAdmin {
  return { id: "a1", email: "sara@uni.edu", displayName: "Sara", enabled: true, signedIn: true, invitationPending: false, twoFactorEnabled: true, ...overrides };
}

function uni(overrides: Partial<OwnerUniversity> = {}): OwnerUniversity {
  return {
    id: "u1", name: "Cairo University", slug: "cairo", active: true, createdAt: daysAgo(100),
    accounts: 5, people: 20, rooms: 4, scheduledExamRooms: 10,
    lastSignInAt: daysAgo(1), lastActivityAt: daysAgo(1), admins: [admin()], ...overrides,
  };
}

describe("universityIssues", () => {
  it("is empty for a healthy university", () => {
    expect(universityIssues(uni(), NOW)).toEqual([]);
  });

  it("flags a missing, waiting or unprotected administrator", () => {
    expect(universityIssues(uni({ admins: [] }), NOW)).toContain("no-admin");
    expect(universityIssues(uni({ admins: [admin({ enabled: false })] }), NOW)).toContain("no-admin");
    expect(universityIssues(uni({ admins: [admin({ signedIn: false, invitationPending: true })] }), NOW)).toEqual(["admin-waiting"]);
    expect(universityIssues(uni({ admins: [admin({ twoFactorEnabled: false })] }), NOW)).toEqual(["admin-no-2fa"]);
  });

  it("flags 30 days without activity, but never a switched-off university", () => {
    expect(universityIssues(uni({ lastActivityAt: daysAgo(31), lastSignInAt: daysAgo(31) }), NOW)).toEqual(["inactive"]);
    expect(universityIssues(uni({ lastActivityAt: null, lastSignInAt: null, createdAt: daysAgo(2) }), NOW)).toEqual([]);
    expect(universityIssues(uni({ active: false, admins: [] }), NOW)).toEqual([]);
  });
});

describe("filterUniversities", () => {
  const list = [
    uni({ id: "1", name: "Beta", slug: "beta", accounts: 1, createdAt: daysAgo(5) }),
    uni({ id: "2", name: "Alpha", slug: "alpha", accounts: 9, active: false }),
    uni({ id: "3", name: "Gamma", slug: "gamma", admins: [], createdAt: daysAgo(1) }),
  ];

  it("searches name, code and admin email", () => {
    expect(filterUniversities(list, { query: "GAM" }, NOW).map((u) => u.id)).toEqual(["3"]);
    expect(filterUniversities(list, { query: "sara@" }, NOW).map((u) => u.id)).toEqual(["2", "1"]);
  });

  it("filters by status and attention", () => {
    expect(filterUniversities(list, { filter: "off" }, NOW).map((u) => u.id)).toEqual(["2"]);
    expect(filterUniversities(list, { filter: "active" }, NOW).map((u) => u.id)).toEqual(["1", "3"]);
    expect(filterUniversities(list, { filter: "attention" }, NOW).map((u) => u.id)).toEqual(["3"]);
  });

  it("sorts", () => {
    expect(filterUniversities(list, { sort: "name" }, NOW).map((u) => u.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(filterUniversities(list, { sort: "accounts" }, NOW)[0].name).toBe("Alpha");
    expect(filterUniversities(list, { sort: "newest" }, NOW)[0].name).toBe("Gamma");
  });
});

describe("helpers", () => {
  it("summarises administrator security", () => {
    const summary = securitySummary([uni({ admins: [admin(), admin({ twoFactorEnabled: false }), admin({ signedIn: false }), admin({ enabled: false })] })]);
    expect(summary).toEqual({ admins: 4, signedIn: 2, withTwoFactor: 1, waiting: 1, disabled: 1 });
  });

  it("names the administrator status", () => {
    expect(adminStatus(admin())).toBe("active");
    expect(adminStatus(admin({ signedIn: false, invitationPending: true }))).toBe("invited");
    expect(adminStatus(admin({ signedIn: false }))).toBe("waiting");
    expect(adminStatus(admin({ enabled: false }))).toBe("disabled");
  });

  it("formats relative times and initials", () => {
    expect(relativeTime(null, NOW)).toBe("Never");
    expect(relativeTime(new Date(NOW - 5 * 60000).toISOString(), NOW)).toBe("5 min ago");
    expect(relativeTime(daysAgo(1), NOW)).toBe("yesterday");
    expect(relativeTime(daysAgo(3), NOW)).toBe("3 days ago");
    expect(initials("Cairo University")).toBe("CU");
    expect(initials("  ")).toBe("?");
  });
});
