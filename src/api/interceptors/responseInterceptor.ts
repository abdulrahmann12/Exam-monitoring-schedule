import type { AxiosInstance } from "axios";
import { toast } from "sonner";

import {
    DEMO_RESTRICTION_ERROR_CODE,
    DEMO_RESTRICTION_TOAST_ID,
    DEMO_RESTRICTION_TOAST_MESSAGE,
    isDemoRestrictionError,
} from "../../lib/demoMode";
import { ApiError } from "../types";
import { clearStoredAuthSession } from "../utils/authStorage";
import { logApiError, normalizeApiError } from "../utils/errorHandler";
import { redirectToLogin } from "../utils/navigation";

export function applyResponseInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
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

      if (handledError.status === 401 && handledError.code !== "AUTH_MISSING" && handledError.code !== "AUTH_EXPIRED") {
        clearStoredAuthSession();
        redirectToLogin();
      }

      logApiError(handledError);

      return Promise.reject(handledError);
    },
  );
}