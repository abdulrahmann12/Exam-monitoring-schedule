import axios from "axios";

import {
    DEMO_LOGIN_INVALID_RESPONSE_MESSAGE,
    DEMO_LOGIN_NETWORK_MESSAGE,
    DEMO_LOGIN_RATE_LIMIT_MESSAGE,
    DEMO_LOGIN_TIMEOUT_MESSAGE,
    DEMO_LOGIN_UNAVAILABLE_MESSAGE,
    isDemoLoginPath,
} from "../../lib/demoMode";
import { ApiError, type BackendErrorResponse } from "../types";

function extractTextMessage(payload: string): string | undefined {
  const trimmedPayload = payload.trim();

  if (!trimmedPayload) {
    return undefined;
  }

  const lowercasePayload = trimmedPayload.toLowerCase();

  if (
    lowercasePayload.startsWith("<!doctype")
    || lowercasePayload.startsWith("<html")
    || lowercasePayload.includes("<body")
  ) {
    return undefined;
  }

  return trimmedPayload;
}

function extractBackendError(payload: unknown): BackendErrorResponse | null {
  if (typeof payload === "string") {
    const message = extractTextMessage(payload);
    return message ? { message } : null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const validationErrors = Array.isArray(candidate.validationErrors)
    ? candidate.validationErrors
        .filter((item): item is { field: string; message: string } => {
          if (!item || typeof item !== "object") {
            return false;
          }

          const validationError = item as Record<string, unknown>;
          return (
            typeof validationError.field === "string" && typeof validationError.message === "string"
          );
        })
        .map((item) => ({ field: item.field, message: item.message }))
    : [];

  return {
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    error: typeof candidate.error === "string" ? candidate.error : undefined,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : typeof candidate.error === "string"
          ? candidate.error
          : undefined,
    path: typeof candidate.path === "string" ? candidate.path : undefined,
    validationErrors,
  };
}

function isLoginRequest(requestPath?: string): boolean {
  return Boolean(requestPath && requestPath.endsWith("/api/auth/login"));
}

function toUserFriendlyMessage(options: {
  status?: number;
  backendMessage?: string;
  validationErrors?: Array<{ field: string; message: string }>;
  isNetworkError: boolean;
  isTimeoutError: boolean;
  requestPath?: string;
}): string {
  const { status, backendMessage, validationErrors = [], isNetworkError, isTimeoutError, requestPath } = options;
  const isDemoLoginRequest = isDemoLoginPath(requestPath);

  if (isTimeoutError) {
    return isDemoLoginRequest
      ? DEMO_LOGIN_TIMEOUT_MESSAGE
      : "The scheduling service took too long to respond. Please try again.";
  }

  if (isNetworkError) {
    return isDemoLoginRequest
      ? DEMO_LOGIN_NETWORK_MESSAGE
      : "Unable to reach the scheduling service. Check the backend connection and try again.";
  }

  if (isDemoLoginRequest) {
    switch (status) {
      case 404:
        return DEMO_LOGIN_UNAVAILABLE_MESSAGE;
      case 429:
        return DEMO_LOGIN_RATE_LIMIT_MESSAGE;
      default:
        if (typeof status === "number" && status >= 500) {
          return DEMO_LOGIN_INVALID_RESPONSE_MESSAGE;
        }
    }
  }

  switch (status) {
    case 400:
      return validationErrors.length > 0
        ? "Some submitted values are invalid. Review the form and try again."
        : backendMessage || "The request could not be processed. Review the submitted data and try again.";
    case 401:
      return isLoginRequest(requestPath)
        ? "Invalid email or password."
        : "Your session is no longer valid. Please sign in again.";
    case 403:
      return isLoginRequest(requestPath)
        ? "Invalid email or password."
        : backendMessage || "You do not have permission to perform this action.";
    case 404:
      return backendMessage || "The requested resource could not be found.";
    case 409:
      return backendMessage || "The request conflicts with the current server state.";
    case 429:
      return "Too many requests were sent. Please wait a moment and try again.";
    default:
      if (typeof status === "number" && status >= 500) {
        return "The server could not complete the request. Please try again later.";
      }

      return backendMessage || "An unexpected error occurred while contacting the scheduling service.";
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const backendError = extractBackendError(error.response?.data);
    const requestPath = backendError?.path ?? error.config?.url;
    const isTimeoutError = error.code === "ECONNABORTED";
    const isNetworkError = !error.response;

    return new ApiError({
      message: toUserFriendlyMessage({
        status: backendError?.status ?? error.response?.status,
        backendMessage: backendError?.message,
        validationErrors: backendError?.validationErrors,
        isNetworkError,
        isTimeoutError,
        requestPath,
      }),
      status: backendError?.status ?? error.response?.status,
      backendMessage: backendError?.message ?? error.message,
      path: requestPath,
      timestamp: backendError?.timestamp,
      validationErrors: backendError?.validationErrors,
      code: error.code,
      isNetworkError,
      isTimeoutError,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      message: "An unexpected error occurred while contacting the scheduling service.",
      backendMessage: error.message,
      cause: error,
    });
  }

  return new ApiError({
    message: "An unexpected error occurred while contacting the scheduling service.",
    cause: error,
  });
}

export function logApiError(error: ApiError): void {
  console.error("[api] request failed", {
    message: error.message,
    backendMessage: error.backendMessage,
    status: error.status,
    path: error.path,
    validationErrors: error.validationErrors,
    code: error.code,
    isNetworkError: error.isNetworkError,
    isTimeoutError: error.isTimeoutError,
  });
}