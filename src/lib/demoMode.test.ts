import { ApiError } from "@/api/types";

import {
    DEMO_RESTRICTION_BACKEND_MESSAGE,
    DEMO_RESTRICTION_ERROR_CODE,
    DEMO_RESTRICTION_TOAST_MESSAGE,
    isDemoLoginPath,
    isDemoRestrictionError,
    isDemoUser,
} from "./demoMode";

describe("demoMode helpers", () => {
  it("detects demo users from normalized demo-admin roles", () => {
    expect(isDemoUser({ roles: ["ADMIN", "DEMO_ADMIN"] })).toBe(true);
    expect(isDemoUser({ roles: ["ROLE_DEMO_ADMIN"] })).toBe(true);
    expect(isDemoUser({ roles: ["ADMIN"] })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });

  it("detects demo login requests from relative or absolute paths", () => {
    expect(isDemoLoginPath("/api/auth/demo-login")).toBe(true);
    expect(isDemoLoginPath("http://localhost:8080/api/auth/demo-login")).toBe(true);
    expect(isDemoLoginPath("/api/auth/login")).toBe(false);
  });

  it("identifies demo restriction errors from backend or normalized codes", () => {
    expect(isDemoRestrictionError({
      status: 403,
      backendMessage: DEMO_RESTRICTION_BACKEND_MESSAGE,
    })).toBe(true);

    expect(isDemoRestrictionError(new ApiError({
      message: DEMO_RESTRICTION_TOAST_MESSAGE,
      status: 403,
      backendMessage: DEMO_RESTRICTION_BACKEND_MESSAGE,
      code: DEMO_RESTRICTION_ERROR_CODE,
    }))).toBe(true);

    expect(isDemoRestrictionError({
      status: 403,
      backendMessage: "Access denied.",
    })).toBe(false);
  });
});