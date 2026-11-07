import { describe, expect, it } from "vitest";

import type { Assignment } from "@/api";

import { busiestDay, coverageGaps, formatDay, isoDay, relativeDay, upcomingAssignments } from "./insights";

function exam(overrides: Partial<Assignment>): Assignment {
  return {
    id: "a", examDate: "2026-11-10", roomId: "r", roomName: "Hall A", timeSlotId: "s", slotLabel: "Morning",
    startTime: "09:00:00", endTime: "11:00:00", subjectName: "Math", subjectCode: "M1",
    chiefInvigilatorId: "c", chiefInvigilatorName: "Dr. Sara", locked: false, generationVersion: 1, source: "MANUAL",
    invigilators: [{ id: "i", invigilatorId: "p", invigilatorName: "Omar", positionIndex: 0, required: true, createdAt: "" }],
    createdAt: "", updatedAt: "", ...overrides,
  } as Assignment;
}

const TODAY = new Date(2026, 10, 9); // 9 Nov 2026, local

describe("dashboard insights", () => {
  it("finds rooms missing a chief or required invigilators, soonest first", () => {
    const gaps = coverageGaps([
      exam({ id: "ok" }),
      exam({ id: "late", examDate: "2026-11-12", chiefInvigilatorId: null }),
      exam({ id: "early", invigilators: [
        { id: "1", invigilatorId: null, invigilatorName: null, positionIndex: 0, required: true, createdAt: "" },
        { id: "2", invigilatorId: null, invigilatorName: null, positionIndex: 1, required: false, createdAt: "" },
      ] }),
    ]);
    expect(gaps.map((gap) => [gap.assignment.id, gap.missingChief, gap.missingInvigilators])).toEqual([["early", false, 1], ["late", true, 0]]);
  });

  it("lists upcoming exams from today, by date then time", () => {
    const list = upcomingAssignments([
      exam({ id: "past", examDate: "2026-11-08" }),
      exam({ id: "today-late", examDate: "2026-11-09", startTime: "13:00:00" }),
      exam({ id: "today-early", examDate: "2026-11-09", startTime: "09:00:00" }),
      exam({ id: "next", examDate: "2026-11-10" }),
    ], TODAY);
    expect(list.map((item) => item.id)).toEqual(["today-early", "today-late", "next"]);
  });

  it("finds the busiest day and formats days", () => {
    expect(busiestDay([])).toBeNull();
    expect(busiestDay([exam({ examDate: "2026-11-11" }), exam({ examDate: "2026-11-10" }), exam({ examDate: "2026-11-11" })])).toEqual({ date: "2026-11-11", rooms: 2 });
    expect(isoDay(TODAY)).toBe("2026-11-09");
    expect(relativeDay("2026-11-09", TODAY)).toBe("Today");
    expect(relativeDay("2026-11-10", TODAY)).toBe("Tomorrow");
    expect(relativeDay("2026-11-11", TODAY)).toBeNull();
    expect(formatDay("bad")).toBe("bad");
  });
});
