import { describe, expect, it } from "vitest";

import { hasAdjustments } from "./roomAllocationService";

describe("hasAdjustments", () => {
  it("sends the changes when an exam moved or when time slots were (un)ticked", () => {
    expect(hasAdjustments(undefined)).toBe(false);
    expect(hasAdjustments({ times: {}, rooms: {} })).toBe(false); // nothing changed: the exam period's ticks are used
    expect(hasAdjustments({ times: { 2: "09:00-11:00" }, rooms: {} })).toBe(true);
    expect(hasAdjustments({ times: {}, rooms: {}, skipTimes: ["11:30-12:30"] })).toBe(true);
    expect(hasAdjustments({ times: {}, rooms: {}, skipTimes: [] })).toBe(true); // everything ticked again
  });
});
