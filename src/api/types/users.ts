import type { ISOInstant, UUID } from "./api";
import type { UserRole } from "./auth";

/** Roles an administrator can give (the demo role is system-managed). */
export type AssignableRole = Exclude<UserRole, "DEMO_ADMIN">;

export interface AppUser {
  id: UUID;
  email: string;
  displayName: string | null;
  role: AssignableRole;
  enabled: boolean;
  locked: boolean;
  lockedUntil: ISOInstant | null;
  mustChangePassword: boolean;
  lastLoginAt: ISOInstant | null;
  createdAt: ISOInstant;
}

export interface CreateUserRequest {
  email: string;
  displayName?: string | null;
  role: AssignableRole;
  temporaryPassword: string;
}

export interface UpdateUserRequest {
  displayName?: string | null;
  role: AssignableRole;
  enabled: boolean;
}
