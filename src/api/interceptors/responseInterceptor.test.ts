import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { onSessionEnded } from "../utils/authStorage";
import { applyResponseInterceptor } from "./responseInterceptor";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

type Route = (config: InternalAxiosRequestConfig) => number;

/** Axios instance whose "server" answers with the status returned by `route`. */
function createClient(route: Route) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config.url ?? "");
    const status = route(config);
    const response = { data: status === 200 ? { ok: true } : { message: "nope", status }, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError("failed", String(status), config, null, response);
    }
    return response;
  };
  const instance = axios.create({ adapter });
  applyResponseInterceptor(instance);
  return { instance, calls };
}

let unsubscribe: (() => void) | null = null;

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
});

describe("silent session renewal", () => {
  it("renews once and repeats the request when the access cookie expired", async () => {
    let renewed = false;
    const { instance, calls } = createClient((config) => {
      if (config.url === "/api/auth/refresh") {
        renewed = true;
        return 200;
      }
      return renewed ? 200 : 401;
    });

    const response = await instance.get("/api/people");

    expect(response.status).toBe(200);
    expect(calls).toEqual(["/api/people", "/api/auth/refresh", "/api/people"]);
  });

  it("shares one renewal between requests that fail at the same time", async () => {
    let renewed = false;
    const { instance, calls } = createClient((config) => {
      if (config.url === "/api/auth/refresh") {
        renewed = true;
        return 200;
      }
      return renewed ? 200 : 401;
    });

    await Promise.all([instance.get("/api/people"), instance.get("/api/rooms"), instance.get("/api/slots")]);

    expect(calls.filter((url) => url === "/api/auth/refresh")).toHaveLength(1);
  });

  it("signs out (once per request, no loop) when the session cannot be renewed", async () => {
    const ended = vi.fn();
    unsubscribe = onSessionEnded(ended);
    const { instance, calls } = createClient(() => 401);

    await expect(instance.get("/api/people")).rejects.toMatchObject({ status: 401 });

    expect(calls).toEqual(["/api/people", "/api/auth/refresh", "/api/people"]);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("never tries to renew for the sign-in endpoints themselves", async () => {
    const ended = vi.fn();
    unsubscribe = onSessionEnded(ended);
    const { instance, calls } = createClient(() => 401);

    await expect(instance.post("/api/auth/login", {})).rejects.toMatchObject({ status: 401 });

    expect(calls).toEqual(["/api/auth/login"]);
    expect(ended).not.toHaveBeenCalled();
  });

  it("leaves other errors alone", async () => {
    const { instance, calls } = createClient(() => 403);

    await expect(instance.post("/api/people", {})).rejects.toMatchObject({ status: 403 });

    expect(calls).toEqual(["/api/people"]);
  });
});
