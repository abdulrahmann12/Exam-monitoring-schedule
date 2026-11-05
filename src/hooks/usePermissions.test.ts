import { describe, expect, it } from "vitest";

import { permissionsFor, resolveRole, roleLabel } from "./usePermissions";

describe("role permissions (UI only; the server enforces the same rules)", () => {
  it("administrators can do everything", () => {
    expect(permissionsFor("ADMIN")).toMatchObject({ canEdit: true, canEditSettings: true, canManageUsers: true });
  });

  it("schedulers edit schedules but not settings or users", () => {
    expect(permissionsFor("SCHEDULER")).toMatchObject({ canEdit: true, canEditSettings: false, canManageUsers: false });
  });

  it("viewers are read-only", () => {
    expect(permissionsFor("VIEWER")).toMatchObject({ canEdit: false, canEditSettings: false, canManageUsers: false });
  });

  it("the demo edits its local sandbox but never sees users", () => {
    expect(permissionsFor("DEMO_ADMIN")).toMatchObject({ canEdit: true, canManageUsers: false });
  });

  it("no known role means no rights", () => {
    expect(permissionsFor(null)).toMatchObject({ canEdit: false, canEditSettings: false, canManageUsers: false });
    expect(resolveRole({ roles: ["ROLE_SOMETHING_ELSE"] })).toBeNull();
    expect(resolveRole(null)).toBeNull();
  });

  it("reads the role field, or falls back to the authority names", () => {
    expect(resolveRole({ role: "VIEWER", roles: ["ROLE_VIEWER"] })).toBe("VIEWER");
    expect(resolveRole({ roles: ["ROLE_SCHEDULER"] })).toBe("SCHEDULER");
    expect(resolveRole({ roles: ["ROLE_DEMO_ADMIN"] })).toBe("DEMO_ADMIN");
    expect(roleLabel("SCHEDULER")).toBe("Scheduler");
  });
});
