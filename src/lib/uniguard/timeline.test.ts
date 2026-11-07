import { describe, expect, it } from "vitest";

import { chiefRoomCounts, roomStaffing, staffingGapLabel } from "./timeline";
import type { Assignment } from "./types";

const exam = (overrides: Partial<Assignment>): Assignment => ({
  roomId: "r", slotId: "s", chiefInvigilatorId: "c", invigilatorIds: ["a", "b"], locked: false, ...overrides,
});

describe("timeline staffing", () => {
  it("is complete when the chief and every required invigilator are there", () => {
    const staffing = roomStaffing(exam({}), { minInvigilators: 2 });
    expect(staffing.complete).toBe(true);
    expect(staffingGapLabel(staffing)).toBeNull();
  });

  it("names what is missing in one short label", () => {
    expect(staffingGapLabel(roomStaffing(exam({ chiefInvigilatorId: null, invigilatorIds: [null, null, null, null] }), { minInvigilators: 4 })))
      .toBe("No chief · 4 invigilators missing");
    expect(staffingGapLabel(roomStaffing(exam({ invigilatorIds: ["a", null, null] }), { minInvigilators: 3 })))
      .toBe("2 of 3 invigilators missing");
    // More students than the room minimum covers raises the need.
    expect(roomStaffing(exam({ invigilatorIds: ["a"], studentCount: 90 }), { minInvigilators: 1 }, 30).missingInvigilators).toBe(2);
  });

  it("counts the rooms each chief covers in one slot", () => {
    const counts = chiefRoomCounts([exam({ roomId: "1" }), exam({ roomId: "2" }), exam({ roomId: "3", chiefInvigilatorId: "x" }), exam({ chiefInvigilatorId: null })]);
    expect(counts.get("c")).toBe(2);
    expect(counts.get("x")).toBe(1);
  });
});
