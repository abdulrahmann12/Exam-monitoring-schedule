import type { CurrentSession, UserRole } from "@/api/types";
import { isDemoUser } from "@/lib/demoMode";
import { useAuth } from "@/state/auth";

export interface Permissions {
  role: UserRole | null;
  /** Create/edit/delete schedules, people, rooms, time slots. The demo edits a local sandbox. */
  canEdit: boolean;
  /** Change system settings (branding, scheduling rules). */
  canEditSettings: boolean;
  /** Open the Users page. */
  canManageUsers: boolean;
  /** Platform owner: only the owner panel, never a university's data. */
  isOwner: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  SCHEDULER: "Scheduler",
  VIEWER: "Viewer",
  DEMO_ADMIN: "Demo",
  SUPER_ADMIN: "Platform owner",
};

export function roleLabel(role: UserRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : "Signed in";
}

/** The role, falling back to the authority list for servers that do not send `role` yet. */
export function resolveRole(user: Pick<CurrentSession, "role" | "roles"> | null | undefined): UserRole | null {
  if (!user) {
    return null;
  }
  if (user.role) {
    return user.role;
  }
  if (isDemoUser(user)) {
    return "DEMO_ADMIN";
  }
  const names = (user.roles ?? []).map((role) => role.trim().toUpperCase().replace(/^ROLE_/, ""));
  for (const candidate of ["SUPER_ADMIN", "ADMIN", "SCHEDULER", "VIEWER"] as const) {
    if (names.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function permissionsFor(role: UserRole | null): Permissions {
  return {
    role,
    canEdit: role === "ADMIN" || role === "SCHEDULER" || role === "DEMO_ADMIN",
    canEditSettings: role === "ADMIN" || role === "DEMO_ADMIN",
    canManageUsers: role === "ADMIN",
    isOwner: role === "SUPER_ADMIN",
  };
}

/**
 * What the signed-in user may do. Used only to hide buttons: the server checks every request
 * on its own, so this is a convenience, not a security boundary.
 */
export function usePermissions(): Permissions {
  const { user } = useAuth();
  return permissionsFor(resolveRole(user));
}
