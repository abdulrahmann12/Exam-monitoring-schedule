import { describe, expect, it } from "vitest";

import type { AllocatedExam } from "@/api";

import { problemReasons } from "@/lib/uniguard/dropCheck";

const exam = (extra: Partial<AllocatedExam>): AllocatedExam => ({
  row: 25, subjectName: "Sports Psychology", subjectCode: "SPT210", students: 52, roomType: null, freeOfType: null, timeChosen: true,
  edited: false, gender: null, mixedHalls: false, unplaced: 0, hints: [], rooms: [], ...extra,
});

describe("why an exam is yellow", () => {
  it("says a Female exam is in a Mixed hall and that the seats are fine", () => {
    expect(problemReasons(exam({ gender: "Female", mixedHalls: true }))).toEqual([
      "Problem: a Female exam in a Mixed hall (no free Female hall at this time). Seats are fine.",
    ]);
  });

  it("says how many students have no seat", () => {
    expect(problemReasons(exam({ unplaced: 7 }))).toEqual(["Problem: 7 of 52 students have no seat."]);
    expect(problemReasons(exam({}))).toEqual([]);
  });
});
