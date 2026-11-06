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
  accessExpiresAt: ISOInstant | null;
  sessionExpiresAt: ISOInstant | null;
  /** Password was right; the code from the authenticator app is still needed (no session yet). */
  twoFactorRequired?: boolean;
}

/** What a password sign-in led to. */
export type LoginOutcome = "signed-in" | "two-factor";

/**
 * ADMIN = everything; SCHEDULER = edit schedules; VIEWER = read-only; DEMO_ADMIN = public demo;
 * SUPER_ADMIN = platform owner (owner panel only, belongs to no university).
 */
export type UserRole = "ADMIN" | "SCHEDULER" | "VIEWER" | "DEMO_ADMIN" | "SUPER_ADMIN";

export interface CurrentSession {
  id?: string;
  email: string;
  displayName?: string | null;
  role?: UserRole;
  /** Spring authority names, e.g. ROLE_ADMIN. */
  roles: string[];
  /** True while the account has a temporary password set by an administrator. */
  mustChangePassword?: boolean;
  /** The university the user belongs to; all data shown is that university's. */
  universityId?: string | null;
  universityName?: string | null;
  /** Two-step sign-in is on for this account. */
  twoFactorEnabled?: boolean;
}

export type AuthSession = AuthResponse;

/** What an emailed link is for. */
export type AccountLinkPurpose = "INVITE" | "PASSWORD_RESET";

export interface AccountLinkInfo {
  purpose: AccountLinkPurpose;
  email: string;
  expiresAt: ISOInstant;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
