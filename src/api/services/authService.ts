import {
    DEMO_LOGIN_ENDPOINT,
    DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
} from "../../lib/demoMode";
import type { AuthResponse, CurrentSession, LoginRequest, ServiceResponse } from "../types";
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

async function logout(): Promise<ServiceResponse<null>> {
  clearStoredAuthSession();
  clearDemoSandbox();
  return createSuccessResponse<null>(null);
}

export const authService = {
  login,
  demoLogin,
  getCurrentSession,
  logout,
};