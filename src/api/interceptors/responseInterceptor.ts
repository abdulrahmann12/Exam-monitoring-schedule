import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";

import {
    DEMO_RESTRICTION_ERROR_CODE,
    DEMO_RESTRICTION_TOAST_ID,
    DEMO_RESTRICTION_TOAST_MESSAGE,
    isDemoRestrictionError,
} from "../../lib/demoMode";
import { ApiError } from "../types";
import { notifySessionEnded } from "../utils/authStorage";
import { logApiError, normalizeApiError } from "../utils/errorHandler";

export const REFRESH_ENDPOINT = "/api/auth/refresh";

/** Endpoints that never trigger a silent renewal (they are the sign-in/renewal flow itself). */
const SESSION_ENDPOINTS = [
  "/api/auth/login",
  "/api/auth/demo-login",
  REFRESH_ENDPOINT,
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/reset-password/check",
];

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

function isSessionEndpoint(url?: string): boolean {
  return Boolean(url && SESSION_ENDPOINTS.some((endpoint) => url === endpoint || url.endsWith(endpoint)));
}

let refreshInFlight: Promise<void> | null = null;

/**
 * Renews the session with the HttpOnly refresh cookie. Concurrent callers share one request, so
 * ten API calls failing at once cause a single renewal. Never rejects: a failed renewal shows up
 * as the retried request failing again.
 */
export function renewSession(instance: AxiosInstance): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = instance
      .post(REFRESH_ENDPOINT)
      .then(() => undefined, () => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export function applyResponseInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const config = (error as AxiosError | undefined)?.config as RetriableConfig | undefined;
      const status = (error as AxiosError | undefined)?.response?.status;

      // Access cookie expired: renew once, then repeat the original request once. The retry also
      // happens when the renewal was answered "renewed in another tab" — the browser then already
      // holds the new cookies.
      if (status === 401 && config && !config._authRetried && !isSessionEndpoint(config.url)) {
        config._authRetried = true;
        await renewSession(instance);
        return instance.request(config);
      }

      const apiError = normalizeApiError(error);
      const handledError = isDemoRestrictionError(apiError)
        ? new ApiError({
            message: DEMO_RESTRICTION_TOAST_MESSAGE,
            status: apiError.status,
            backendMessage: apiError.backendMessage,
            path: apiError.path,
            timestamp: apiError.timestamp,
            validationErrors: apiError.validationErrors,
            code: DEMO_RESTRICTION_ERROR_CODE,
            isNetworkError: apiError.isNetworkError,
            isTimeoutError: apiError.isTimeoutError,
            cause: apiError,
          })
        : apiError;

      if (handledError !== apiError) {
        toast.error(DEMO_RESTRICTION_TOAST_MESSAGE, { id: DEMO_RESTRICTION_TOAST_ID });
      }

      // Still 401 after renewing: the session is really over (logged out, expired, disabled).
      if (handledError.status === 401 && !isSessionEndpoint(config?.url)) {
        notifySessionEnded();
      }

      logApiError(handledError);

      return Promise.reject(handledError);
    },
  );
}
