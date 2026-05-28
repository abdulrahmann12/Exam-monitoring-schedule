import type { CurrentSession } from "@/api/types";

export const DEMO_ADMIN_ROLE = "DEMO_ADMIN";
export const DEMO_LOGIN_ENDPOINT = "/api/auth/demo-login";
export const DEMO_LOGIN_UNAVAILABLE_MESSAGE = "Public demo is currently unavailable.";
export const DEMO_LOGIN_RATE_LIMIT_MESSAGE = "Public demo is busy right now. Please wait a minute and try again.";
export const DEMO_LOGIN_NETWORK_MESSAGE = "Unable to start the public demo right now. Check the backend connection and try again.";
export const DEMO_LOGIN_TIMEOUT_MESSAGE = "The public demo took too long to start. Please try again.";
export const DEMO_LOGIN_INVALID_RESPONSE_MESSAGE = "Unable to start the public demo right now. Please try again later.";
export const DEMO_MODE_BANNER_MESSAGE = "Demo Mode — Changes are temporary and reset after refresh.";
export const DEMO_RESTRICTION_BACKEND_MESSAGE = "Operation disabled in demo mode.";
export const DEMO_RESTRICTION_TOAST_MESSAGE = "This action is disabled in public demo mode.";
export const DEMO_RESTRICTION_TOAST_ID = "demo-mode-restricted";
export const DEMO_RESTRICTION_ERROR_CODE = "DEMO_MODE_RESTRICTED";

type DemoErrorLike = {
  status?: number;
  backendMessage?: string;
  code?: string;
  message?: string;
} | null | undefined;

function normalizeRoleName(role: string): string {
  return role.trim().toUpperCase().replace(/^ROLE_/, "");
}

export function isDemoUser(user: Pick<CurrentSession, "roles"> | null | undefined): boolean {
  return user?.roles?.some((role) => normalizeRoleName(role) === DEMO_ADMIN_ROLE) ?? false;
}

export function isDemoLoginPath(path?: string): boolean {
  return Boolean(path && path.endsWith(DEMO_LOGIN_ENDPOINT));
}

export function isDemoRestrictionError(error: DemoErrorLike): boolean {
  if (!error) {
    return false;
  }

  return error.code === DEMO_RESTRICTION_ERROR_CODE
    || (error.status === 403 && error.backendMessage === DEMO_RESTRICTION_BACKEND_MESSAGE)
    || error.message === DEMO_RESTRICTION_TOAST_MESSAGE;
}