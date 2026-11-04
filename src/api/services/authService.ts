import {
    DEMO_LOGIN_ENDPOINT,
    DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
} from "../../lib/demoMode";
import type { AuthResponse, ChangePasswordRequest, CurrentSession, LoginRequest, ServiceResponse } from "../types";
import { ApiError } from "../types";
import { clearStoredAuthSession, setStoredAuthSession } from "../utils/authStorage";
import { clearDemoSandbox } from "../utils/demoSandbox";
import { performRequest } from "../utils/request";
import { createErrorResponse, createSuccessResponse } from "../utils/serviceResponse";

const AUTH_ENDPOINT = "/api/auth";

function hasValidAuthResponse(session: AuthResponse): boolean {
  return typeof session.accessToken === "string"
    && session.accessToken.trim().length > 0
    && typeof session.tokenType === "string"
    && session.tokenType.trim().length > 0
    && typeof session.expiresAt === "string"
    && session.expiresAt.trim().length > 0
    && typeof session.email === "string"
    && session.email.trim().length > 0;
}

async function login(payload: LoginRequest): Promise<ServiceResponse<AuthResponse>> {
  const response = await performRequest<AuthResponse>({
    url: `${AUTH_ENDPOINT}/login`,
    method: "POST",
    data: payload,
  });

  if (response.success) {
    setStoredAuthSession(response.data);
  }

  return response;
}

async function demoLogin(): Promise<ServiceResponse<AuthResponse>> {
  const response = await performRequest<AuthResponse>({
    url: DEMO_LOGIN_ENDPOINT,
    method: "POST",
  });

  if (!response.success) {
    return response;
  }

  if (!hasValidAuthResponse(response.data)) {
    clearStoredAuthSession();

    return createErrorResponse<AuthResponse>(new ApiError({
      message: DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
      backendMessage: "Demo login returned an invalid authentication payload.",
      status: 502,
      code: "DEMO_LOGIN_INVALID_RESPONSE",
    }));
  }

  setStoredAuthSession(response.data);

  return response;
}

async function getCurrentSession(): Promise<ServiceResponse<CurrentSession>> {
  return performRequest<CurrentSession>({
    url: `${AUTH_ENDPOINT}/me`,
    method: "GET",
  });
}

/**
 * Revokes the token on the server (all of this user's sessions), then clears local state.
 * Local logout always happens, even if the server call fails (offline, expired token).
 */
async function logout(): Promise<ServiceResponse<null>> {
  try {
    await performRequest<unknown, null>({ url: `${AUTH_ENDPOINT}/logout`, method: "POST" }, () => null);
  } catch {
    // Best effort — the token is discarded locally regardless.
  }
  clearStoredAuthSession();
  clearDemoSandbox();
  return createSuccessResponse<null>(null);
}

/** Changes the password; the server revokes other sessions and returns a fresh token for this one. */
async function changePassword(payload: ChangePasswordRequest): Promise<ServiceResponse<AuthResponse>> {
  const response = await performRequest<AuthResponse>({
    url: `${AUTH_ENDPOINT}/change-password`,
    method: "POST",
    data: payload,
  });
  if (response.success && hasValidAuthResponse(response.data)) {
    setStoredAuthSession(response.data);
  }
  return response;
}

export const authService = {
  login,
  demoLogin,
  getCurrentSession,
  logout,
  changePassword,
};