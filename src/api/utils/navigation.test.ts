import { afterEach, describe, expect, it, vi } from "vitest";

import { LOGIN_ROUTE, navigationRuntime, redirectToLogin, registerNavigationHandler } from "./navigation";

describe("redirectToLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("uses the registered router navigation handler when available", () => {
    const navigate = vi.fn();
    const unregister = registerNavigationHandler(navigate);
    const replaceSpy = vi.spyOn(navigationRuntime, "replaceLocation").mockImplementation(() => {});

    window.history.replaceState({}, "", "/dashboard");

    redirectToLogin();

    expect(navigate).toHaveBeenCalledWith(LOGIN_ROUTE, { replace: true });
    expect(replaceSpy).not.toHaveBeenCalled();

    unregister();
  });

  it("falls back to a location replacement when no router handler is registered", () => {
    const replaceSpy = vi.spyOn(navigationRuntime, "replaceLocation").mockImplementation(() => {});

    window.history.replaceState({}, "", "/dashboard");

    redirectToLogin();

    expect(replaceSpy).toHaveBeenCalledWith(LOGIN_ROUTE);
  });

  it("does nothing when already on the login route", () => {
    const replaceSpy = vi.spyOn(navigationRuntime, "replaceLocation").mockImplementation(() => {});

    window.history.replaceState({}, "", LOGIN_ROUTE);

    redirectToLogin();

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it.each(["/reset-password", "/reset-password/", "/forgot-password"])(
    "keeps a signed-out visitor on the public page %s (email password links)",
    (path) => {
      const navigate = vi.fn();
      const unregister = registerNavigationHandler(navigate);
      const replaceSpy = vi.spyOn(navigationRuntime, "replaceLocation").mockImplementation(() => {});

      window.history.replaceState({}, "", path);

      redirectToLogin();

      expect(navigate).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();

      unregister();
    },
  );
});