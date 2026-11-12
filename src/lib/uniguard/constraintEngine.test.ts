import { describe, expect, it } from "vitest";

import { getPickerTiers, validateSlotAssignments } from "./constraintEngine";
import { requiredInvigilators } from "./types";
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

describe("hall gender, own subject and student-based seats", () => {
  const femaleHall: Room = { id: "fh", name: "Female Hall", capacity: 60, minInvigilators: 1, hallGender: "FEMALE" };

  it("flags staff who do not match a gender-separated hall", () => {
    const people = [
      staff({ id: "c1", role: "CHIEF_INVIGILATOR", gender: "FEMALE" }),
      staff({ id: "ali", role: "INVIGILATOR", gender: "MALE" }),
    ];
    const result = validateSlotAssignments({ assignments: [{ ...assignment("fh", "c1", ["ali"]) }], rooms: [femaleHall], staff: people, day: "Sun" });
    expect(result.state).toBe("CONFLICT");
    expect(result.issues.some((issue) => issue.type === "gender" && issue.staffId === "ali")).toBe(true);
  });

  it("flags a teacher invigilating their own subject and hides them in the picker", () => {
    const people = [staff({ id: "c1", role: "CHIEF_INVIGILATOR" }), staff({ id: "sara", role: "INVIGILATOR", subjectCodes: ["MATH101"] })];
    const exam = { ...assignment("r1", "c1", ["sara"]), subjectCode: "math101" };
    const result = validateSlotAssignments({ assignments: [exam], rooms, staff: people, day: "Sun" });
    expect(result.issues.some((issue) => issue.type === "subject")).toBe(true);

    const tiers = getPickerTiers({ role: "INVIGILATOR", day: "Sun", staff: people, assignments: [], room: rooms[0], subjectCode: "MATH101" });
    expect(tiers.unavailable.map((u) => u.reason)).toEqual(["Teaches this subject"]);
  });

  it("hides people busy in another exam period or on leave (the server said so)", () => {
    const people = [
      staff({ id: "atef", role: "INVIGILATOR" }), staff({ id: "free", role: "INVIGILATOR" }), staff({ id: "away", role: "INVIGILATOR" }),
      staff({ id: "c1", role: "CHIEF_INVIGILATOR" }),
    ];
    const elsewhere = new Map([
      ["atef", { invigilator: true, chiefRooms: 0, onLeave: false, reason: "Busy in test at 12:00–13:00" }],
      ["away", { invigilator: false, chiefRooms: 0, onLeave: true, reason: "On leave" }],
      ["c1", { invigilator: false, chiefRooms: 99, onLeave: false, reason: "Busy in test at 12:00–13:00" }],
    ]);
    const tiers = getPickerTiers({ role: "INVIGILATOR", day: "Sun", staff: people, assignments: [], elsewhere });
    expect(tiers.free.map((person) => person.id)).toEqual(["free"]);
    expect(tiers.unavailable.map((u) => u.reason).sort()).toEqual(["Busy in test at 12:00–13:00", "On leave"]);
    const chiefs = getPickerTiers({ role: "CHIEF_INVIGILATOR", day: "Sun", staff: people, assignments: [], elsewhere });
    expect(chiefs.free).toHaveLength(0); // chief rooms elsewhere count toward the parallel-room limit
  });

  it("needs more invigilators when the student count requires it", () => {
    expect(requiredInvigilators({ minInvigilators: 1 }, 70, 30)).toBe(3);
    expect(requiredInvigilators({ minInvigilators: 2 }, 20, 30)).toBe(2);
    expect(requiredInvigilators({ minInvigilators: 1 }, 70, 0)).toBe(1);

    const people = [staff({ id: "c1", role: "CHIEF_INVIGILATOR" }), staff({ id: "i1", role: "INVIGILATOR" })];
    const exam = { ...assignment("r1", "c1", ["i1"]), studentCount: 70 };
    const result = validateSlotAssignments({ assignments: [exam], rooms, staff: people, day: "Sun", studentsPerInvigilator: 30 });
    expect(result.issues.some((issue) => issue.type === "capacity" && issue.message.includes("needs 3"))).toBe(true);
  });
});


describe("time overlap between different slots", () => {
  it("treats 08:00-09:30 and 09:00-12:00 as the same time, but not back-to-back slots", async () => {
    const { slotsOverlap, overlappingAssignmentsForSlot } = await import("./constraintEngine");
    const period1 = { id: "p1", startTime: "08:00", endTime: "09:30" };
    const morning = { id: "m", startTime: "09:00", endTime: "12:00" };
    const after = { id: "a", startTime: "09:30", endTime: "11:00" };
    expect(slotsOverlap(period1, morning)).toBe(true);
    expect(slotsOverlap(period1, after)).toBe(false);

    const busy = { roomId: "r1", slotId: "p1", chiefInvigilatorId: null, invigilatorIds: ["sara"], locked: false };
    // The picker for the Morning slot sees Sara's Period 1 exam as happening at the same time.
    expect(overlappingAssignmentsForSlot([busy], [period1, morning, after] as never, "m")).toEqual([busy]);
    expect(overlappingAssignmentsForSlot([busy], [period1, morning, after] as never, "a")).toEqual([]);
  });
});
