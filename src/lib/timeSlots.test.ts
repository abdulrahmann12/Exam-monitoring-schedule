import { describe, expect, it } from "vitest";

import { byStartTime, dayRange, durationLabel, hhmm, overlapping } from "./timeSlots";

const slot = (id: string, startTime: string, endTime: string, label = id) => ({ id, label, startTime, endTime });

describe("time slot helpers", () => {
  it("shows times without seconds and lengths in words", () => {
    expect(hhmm("09:00:00")).toBe("09:00");
    expect(durationLabel("09:00:00", "12:00:00")).toBe("3 h");
    expect(durationLabel("09:45", "11:15")).toBe("1 h 30 min");
    expect(durationLabel("10:00", "10:45")).toBe("45 min");
  });

  it("finds real overlaps only (back-to-back slots do not overlap)", () => {
    const morning = slot("m", "09:00", "12:00");
    const p2 = slot("p2", "09:45", "11:15");
    const p3 = slot("p3", "11:30", "13:00");
    const afternoon = slot("a", "13:00", "16:00");
    const all = [morning, p2, p3, afternoon];
    expect(overlapping(morning, all).map((s) => s.id)).toEqual(["p2", "p3"]);
    expect(overlapping(p3, all).map((s) => s.id)).toEqual(["m"]);
    expect(overlapping(afternoon, all)).toEqual([]);
  });

  it("orders by start time and draws the day from the first to the last hour", () => {
    const list = [slot("m", "09:00", "12:00", "Morning"), slot("p1", "08:00", "09:30", "Period 1")].sort(byStartTime);
    expect(list.map((s) => s.label)).toEqual(["Period 1", "Morning"]);
    expect(dayRange([slot("a", "08:15", "09:30"), slot("b", "16:45", "18:15")])).toEqual({ from: 8 * 60, to: 19 * 60 });
  });
});
