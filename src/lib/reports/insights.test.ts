import { describe, expect, it } from "vitest";

import type { Assignment } from "@/api";

import { examsPerDay, formatHours, hoursDistribution, topShare } from "./insights";

describe("report insights", () => {
  it("counts people per hour band", () => {
    const bands = hoursDistribution([{ hours: 0 }, { hours: 0 }, { hours: 1.5 }, { hours: 3 }, { hours: 7 }, { hours: 19.5 }]);
    expect(bands.map((band) => band.people)).toEqual([2, 2, 0, 1, 0, 1]);
  });

  it("says how much of the work the busiest people do", () => {
    const people = [{ hours: 19.5 }, ...Array.from({ length: 9 }, () => ({ hours: 0.5 }))];
    expect(topShare(people)).toEqual({ people: 1, percent: 81 });
    expect(topShare([{ hours: 0 }])).toBeNull();
    expect(topShare([])).toBeNull();
  });

  it("counts exam rooms per day and those that still need staff", () => {
    const exam = (examDate: string, chief: string | null, seat: string | null) => ({
      examDate, chiefInvigilatorId: chief, invigilators: [{ required: true, invigilatorId: seat }],
    }) as unknown as Assignment;
    expect(examsPerDay([exam("2026-11-11", "c", "i"), exam("2026-11-10", null, "i"), exam("2026-11-10", "c", null), exam("2026-11-10", "c", "i")]))
      .toEqual([{ date: "2026-11-10", rooms: 3, needStaff: 2 }, { date: "2026-11-11", rooms: 1, needStaff: 0 }]);
    expect(formatHours(3)).toBe("3");
    expect(formatHours(1.5)).toBe("1.5");
  });
});
