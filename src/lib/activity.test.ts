import { describe, expect, it } from "vitest";

import { dayHeading, describeIp } from "./activity";

describe("activity helpers", () => {
  it("names the local machine instead of showing ::1", () => {
    expect(describeIp("0:0:0:0:0:0:0:1")).toBe("This computer");
    expect(describeIp("::1")).toBe("This computer");
    expect(describeIp("127.0.0.1")).toBe("This computer");
    expect(describeIp("41.233.10.5")).toBe("41.233.10.5");
    expect(describeIp(null)).toBe("—");
  });

  it("groups by Today, Yesterday, then the date", () => {
    const now = new Date(2026, 10, 7, 12, 0);
    expect(dayHeading(new Date(2026, 10, 7, 8, 0).toISOString(), now)).toBe("Today");
    expect(dayHeading(new Date(2026, 10, 6, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(dayHeading(new Date(2026, 10, 3, 9, 0).toISOString(), now)).toMatch(/3/);
  });
});
