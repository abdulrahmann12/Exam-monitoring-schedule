import type { ISOInstant, UUID } from "./api";
import type { UserRole } from "./auth";

/** Roles an administrator can give (the demo role is system-managed). */
export type AssignableRole = Exclude<UserRole, "DEMO_ADMIN" | "SUPER_ADMIN">;

export interface AppUser {
  id: UUID;
  email: string;
  displayName: string | null;
  role: AssignableRole;
  enabled: boolean;
  locked: boolean;
  lockedUntil: ISOInstant | null;
  mustChangePassword: boolean;
  /** An unused, unexpired invitation link exists. */
  invitePending: boolean;
  lastLoginAt: ISOInstant | null;
  createdAt: ISOInstant;
  /** Two-step sign-in is on. */
  twoFactorEnabled: boolean;
}

export interface CreateUserRequest {
  email: string;
  displayName?: string | null;
  role: AssignableRole;
  /** Required unless sendInvite is true. */
  temporaryPassword?: string;
  /** Email the user a link to choose their own password. */
  sendInvite?: boolean;
}

/** Result of creating or inviting a user. */
export interface InviteResponse {
  user: AppUser;
  /** Copyable invitation link (null when a temporary password was used). */
  inviteLink: string | null;
  inviteExpiresAt: ISOInstant | null;
  emailSent: boolean;
}

export interface UpdateUserRequest {
  displayName?: string | null;
  role: AssignableRole;
  enabled: boolean;
}
