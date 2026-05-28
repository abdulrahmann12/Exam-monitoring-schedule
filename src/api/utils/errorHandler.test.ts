import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import {
    DEMO_LOGIN_NETWORK_MESSAGE,
    DEMO_LOGIN_RATE_LIMIT_MESSAGE,
    DEMO_LOGIN_UNAVAILABLE_MESSAGE,
} from "../../lib/demoMode";
import { normalizeApiError } from "./errorHandler";

function createAxiosError(options: {
  status: number;
  data: unknown;
  url: string;
  message?: string;
}): AxiosError {
  const config = {
    headers: {},
    method: "post",
    url: options.url,
  } as InternalAxiosRequestConfig;

  const response = {
    data: options.data,
    status: options.status,
    statusText: "",
    headers: {},
    config,
  } as AxiosResponse;

  return new AxiosError(options.message ?? "Request failed", undefined, config, undefined, response);
}

function createNetworkAxiosError(url: string): AxiosError {
  const config = {
    headers: {},
    method: "post",
    url,
  } as InternalAxiosRequestConfig;

  return new AxiosError("Network Error", "ERR_NETWORK", config);
}

describe("normalizeApiError", () => {
  it("maps login 403 responses to an invalid-credentials message", () => {
    const error = createAxiosError({
      status: 403,
      data: "Forbidden",
      url: "/api/auth/login",
    });

    const apiError = normalizeApiError(error);

    expect(apiError.message).toBe("Invalid email or password.");
    expect(apiError.status).toBe(403);
    expect(apiError.backendMessage).toBe("Forbidden");
    expect(apiError.path).toBe("/api/auth/login");
  });

  it("uses plain text backend messages for non-login 403 responses", () => {
    const error = createAxiosError({
      status: 403,
      data: "Access denied by policy",
      url: "/api/rooms",
    });

    const apiError = normalizeApiError(error);

    expect(apiError.message).toBe("Access denied by policy");
    expect(apiError.status).toBe(403);
    expect(apiError.backendMessage).toBe("Access denied by policy");
    expect(apiError.path).toBe("/api/rooms");
  });

  it("maps demo login 404 responses to a public-demo-unavailable message", () => {
    const error = createAxiosError({
      status: 404,
      data: {
        message: "Demo mode disabled.",
        path: "/api/auth/demo-login",
        status: 404,
      },
      url: "/api/auth/demo-login",
    });

    const apiError = normalizeApiError(error);

    expect(apiError.message).toBe(DEMO_LOGIN_UNAVAILABLE_MESSAGE);
    expect(apiError.status).toBe(404);
    expect(apiError.path).toBe("/api/auth/demo-login");
  });

  it("maps demo login 429 responses to a rate-limited message", () => {
    const error = createAxiosError({
      status: 429,
      data: {
        message: "Too many requests.",
        path: "/api/auth/demo-login",
        status: 429,
      },
      url: "/api/auth/demo-login",
    });

    const apiError = normalizeApiError(error);

    expect(apiError.message).toBe(DEMO_LOGIN_RATE_LIMIT_MESSAGE);
    expect(apiError.status).toBe(429);
  });

  it("maps demo login network failures to a demo-specific message", () => {
    const apiError = normalizeApiError(createNetworkAxiosError("/api/auth/demo-login"));

    expect(apiError.message).toBe(DEMO_LOGIN_NETWORK_MESSAGE);
    expect(apiError.isNetworkError).toBe(true);
  });
});