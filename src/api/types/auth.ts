import type { ISOInstant } from "./api";

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Answer to sign-in / renewal. The tokens themselves are HttpOnly cookies and never reach
 * JavaScript; this only says who signed in and until when.
 */
export interface AuthResponse {
  email: string;
  accessExpiresAt: ISOInstant;
  sessionExpiresAt: ISOInstant | null;
}

/** ADMIN = everything; SCHEDULER = edit schedules; VIEWER = read-only; DEMO_ADMIN = public demo. */
export type UserRole = "ADMIN" | "SCHEDULER" | "VIEWER" | "DEMO_ADMIN";

export interface CurrentSession {
  id?: string;
  email: string;
  displayName?: string | null;
  role?: UserRole;
  /** Spring authority names, e.g. ROLE_ADMIN. */
  roles: string[];
  /** True while the account has a temporary password set by an administrator. */
  mustChangePassword?: boolean;
}

export type AuthSession = AuthResponse;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
