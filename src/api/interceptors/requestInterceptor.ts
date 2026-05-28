import { AxiosHeaders, type AxiosInstance } from "axios";

import { DEMO_LOGIN_ENDPOINT } from "../../lib/demoMode";
import { ApiError } from "../types";
import { clearStoredAuthSession, getStoredAuthSession, isAuthSessionExpired } from "../utils/authStorage";
import { logApiError } from "../utils/errorHandler";
import { redirectToLogin } from "../utils/navigation";

const PUBLIC_ENDPOINTS = new Set(["/api/auth/login", DEMO_LOGIN_ENDPOINT]);

function isPublicEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  for (const endpoint of PUBLIC_ENDPOINTS) {
    if (url === endpoint || url.endsWith(endpoint)) {
      return true;
    }
  }

  return false;
}

export function applyRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    if (isPublicEndpoint(config.url)) {
      return config;
    }

    const session = getStoredAuthSession();

    if (!session?.accessToken) {
      const error = new ApiError({
        message: "You need to sign in to continue.",
        backendMessage: "Missing authentication token.",
        status: 401,
        code: "AUTH_MISSING",
      });

      clearStoredAuthSession();
      redirectToLogin();
      logApiError(error);

      return Promise.reject(error);
    }

    if (isAuthSessionExpired(session)) {
      const error = new ApiError({
        message: "Your session has expired. Please sign in again.",
        backendMessage: "Authentication token expired.",
        status: 401,
        code: "AUTH_EXPIRED",
      });

      clearStoredAuthSession();
      redirectToLogin();
      logApiError(error);

      return Promise.reject(error);
    }

    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `${session.tokenType || "Bearer"} ${session.accessToken}`);
    config.headers = headers;

    return config;
  });
}