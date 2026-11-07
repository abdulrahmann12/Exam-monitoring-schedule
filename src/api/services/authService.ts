import {
    DEMO_LOGIN_ENDPOINT,
    DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
} from "../../lib/demoMode";
import type { AccountLinkInfo, AuthResponse, ChangePasswordRequest, CurrentSession, LoginRequest, ServiceResponse } from "../types";
import { ApiError } from "../types";
import { clearDemoSandbox } from "../utils/demoSandbox";
import { performRequest } from "../utils/request";
import { createErrorResponse, createSuccessResponse } from "../utils/serviceResponse";

const AUTH_ENDPOINT = "/api/auth";

function hasValidAuthResponse(session: AuthResponse | null | undefined): boolean {
  return typeof session?.email === "string" && session.email.trim().length > 0;
}

/** Signs in; the server sets the HttpOnly session cookies. Nothing is stored in the browser by us. */
async function login(payload: LoginRequest): Promise<ServiceResponse<AuthResponse>> {
  return performRequest<AuthResponse>({
    url: `${AUTH_ENDPOINT}/login`,
    method: "POST",
    data: payload,
  });
}

async function demoLogin(): Promise<ServiceResponse<AuthResponse>> {
  const response = await performRequest<AuthResponse>({
    url: DEMO_LOGIN_ENDPOINT,
    method: "POST",
  });

  if (response.success && !hasValidAuthResponse(response.data)) {
    return createErrorResponse<AuthResponse>(new ApiError({
      message: DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
      backendMessage: "Demo login returned an invalid payload.",
      status: 502,
      code: "DEMO_LOGIN_INVALID_RESPONSE",
    }));
  }

  return response;
}

async function getCurrentSession(): Promise<ServiceResponse<CurrentSession>> {
  return performRequest<CurrentSession>({
    url: `${AUTH_ENDPOINT}/me`,
    method: "GET",
  });
}

/**
 * Ends this device's session on the server; the server also deletes the cookies.
 * Works even when the access cookie has already expired.
 */
async function logout(): Promise<ServiceResponse<null>> {
  try {
    await performRequest<unknown, null>({ url: `${AUTH_ENDPOINT}/logout`, method: "POST" }, () => null);
  } catch {
    // Best effort — local state is cleared regardless.
  }
  clearDemoSandbox();
  return createSuccessResponse<null>(null);
}

/** Signs this account out on every device, including this one. */
async function logoutEverywhere(): Promise<ServiceResponse<null>> {
  const response = await performRequest<unknown, null>({ url: `${AUTH_ENDPOINT}/logout-all`, method: "POST" }, () => null);
  if (response.success) {
    clearDemoSandbox();
  }
  return response;
}

/** Changes the password; the server signs out other devices and renews this one's cookie. */
async function changePassword(payload: ChangePasswordRequest): Promise<ServiceResponse<AuthResponse>> {
  return performRequest<AuthResponse>({
    url: `${AUTH_ENDPOINT}/change-password`,
    method: "POST",
    data: payload,
  });
}

/** "Forgot password": the server answers the same way whether or not the account exists. */
async function forgotPassword(email: string): Promise<ServiceResponse<{ message: string }>> {
  return performRequest<{ message: string }>({ url: `${AUTH_ENDPOINT}/forgot-password`, method: "POST", data: { email } });
}

/** Checks an emailed link before showing the password form. */
async function checkPasswordLink(token: string): Promise<ServiceResponse<AccountLinkInfo>> {
  return performRequest<AccountLinkInfo>({ url: `${AUTH_ENDPOINT}/reset-password/check`, method: "POST", data: { token } });
}

/** Sets the password from an invitation or reset link; every existing session is signed out. */
async function setPasswordFromLink(token: string, newPassword: string): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    { url: `${AUTH_ENDPOINT}/reset-password`, method: "POST", data: { token, newPassword } },
    () => null,
  );
}

/** The signed-in person changes their own name. */
async function updateProfile(payload: { displayName: string }): Promise<ServiceResponse<void>> {
  return performRequest<void>({
    url: `${AUTH_ENDPOINT}/profile`,
    method: "PUT",
    data: payload,
  });
}

export interface EmailChangeStarted {
  newEmail: string;
  expiresAt: string;
  emailSent: boolean;
  /** Local development without email only: the confirmation link itself. Never set in production. */
  devLink: string | null;
}

/** Asks to sign in with another email. Nothing changes until the link sent to that address is opened. */
async function requestEmailChange(payload: { newEmail: string; currentPassword: string }): Promise<ServiceResponse<EmailChangeStarted>> {
  return performRequest<EmailChangeStarted>({ url: `${AUTH_ENDPOINT}/email-change`, method: "POST", data: payload });
}

/** The link from the new address: makes it the sign-in email and signs out every device. */
async function confirmEmailChange(token: string): Promise<ServiceResponse<{ message: string }>> {
  return performRequest<{ message: string }>({ url: `${AUTH_ENDPOINT}/email-change/confirm`, method: "POST", data: { token } });
}

export const authService = {
  updateProfile,
  requestEmailChange,
  confirmEmailChange,
  login,
  demoLogin,
  getCurrentSession,
  logout,
  logoutEverywhere,
  changePassword,
  forgotPassword,
  checkPasswordLink,
  setPasswordFromLink,
};
