import { describe, expect, it } from "vitest";

import { getPickerTiers, validateSlotAssignments } from "./constraintEngine";
import type { Assignment, Room, Staff } from "./types";

const rooms: Room[] = [
  { id: "r1", name: "Room 1", capacity: 30, minInvigilators: 1 },
  { id: "r2", name: "Room 2", capacity: 30, minInvigilators: 1 },
  { id: "r3", name: "Room 3", capacity: 30, minInvigilators: 1 },
];

const staff = (overrides: Partial<Staff> & Pick<Staff, "id" | "role">): Staff => ({
  name: overrides.id,
  department: "Exams",
  workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
  totalAssignments: 0,
  maxParallelRooms: overrides.role === "CHIEF_INVIGILATOR" ? 2 : 1,
  ...overrides,
});

const assignment = (roomId: string, chief: string | null, invigilators: Array<string | null>): Assignment => ({
  roomId,
  slotId: "s1",
  chiefInvigilatorId: chief,
  invigilatorIds: invigilators,
  locked: false,
});

describe("constraint hints follow the server-provided parallel-room limit", () => {
  it("flags a chief only when they exceed their own maxParallelRooms", () => {
    const people = [staff({ id: "c1", role: "CHIEF_INVIGILATOR", maxParallelRooms: 3 }), staff({ id: "i1", role: "INVIGILATOR" }), staff({ id: "i2", role: "INVIGILATOR" }), staff({ id: "i3", role: "INVIGILATOR" })];
    const threeRooms = [assignment("r1", "c1", ["i1"]), assignment("r2", "c1", ["i2"]), assignment("r3", "c1", ["i3"])];

    expect(validateSlotAssignments({ assignments: threeRooms, rooms, staff: people, day: "Sun" }).state).toBe("VALID");

    const strict = people.map((p) => (p.id === "c1" ? { ...p, maxParallelRooms: 2 } : p));
    const result = validateSlotAssignments({ assignments: threeRooms, rooms, staff: strict, day: "Sun" });
    expect(result.state).toBe("CONFLICT");
    expect(result.issues.some((issue) => issue.message.includes("2-room"))).toBe(true);
  });

  it("detects an invigilator double-booked at an overlapping time", () => {
    const people = [staff({ id: "c1", role: "CHIEF_INVIGILATOR" }), staff({ id: "i1", role: "INVIGILATOR" })];
    const result = validateSlotAssignments({
      assignments: [assignment("r1", "c1", ["i1"])],
      overlappingAssignments: [assignment("r2", null, ["i1"])],
      rooms,
      staff: people,
      day: "Sun",
    });
    expect(result.issues.map((issue) => issue.type)).toContain("concurrency");
  });

  it("picker tiers use the limit too", () => {
    const people = [staff({ id: "c1", role: "CHIEF_INVIGILATOR", maxParallelRooms: 3 })];
    const tiers = getPickerTiers({
      role: "CHIEF_INVIGILATOR",
      day: "Sun",
      staff: people,
      assignments: [assignment("r1", "c1", []), assignment("r2", "c1", [])],
    });
    expect(tiers.partiallyBusy.map((p) => p.id)).toEqual(["c1"]);
    expect(tiers.unavailable).toHaveLength(0);
  });
});
