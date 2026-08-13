import { describe, expect, it } from "vitest";

import { generateSchedule } from "./engine";
import type { Assignment, Room, Staff } from "./types";

const rooms: Room[] = [
  { id: "room-a", name: "Room A", capacity: 30, minInvigilators: 1 },
  { id: "room-b", name: "Room B", capacity: 30, minInvigilators: 1 },
  { id: "room-c", name: "Room C", capacity: 30, minInvigilators: 1 },
];

const staff: Staff[] = [
  { id: "chief-locked", name: "Chief Locked", role: "CHIEF_INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 5 },
  { id: "chief-stale", name: "Chief Stale", role: "CHIEF_INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 10 },
  { id: "chief-fresh", name: "Chief Fresh", role: "CHIEF_INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 1 },
  { id: "chief-preserved", name: "Chief Preserved", role: "CHIEF_INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 3 },
  { id: "inv-locked", name: "Invigilator Locked", role: "INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 5 },
  { id: "inv-stale", name: "Invigilator Stale", role: "INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 10 },
  { id: "inv-fresh", name: "Invigilator Fresh", role: "INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 1 },
  { id: "inv-preserved", name: "Invigilator Preserved", role: "INVIGILATOR", department: "Exam", workingDays: ["Mon"], totalAssignments: 3 },
];

const existing: Assignment[] = [
  {
    roomId: "room-a",
    slotId: "slot-1",
    chiefInvigilatorId: "chief-locked",
    invigilatorIds: ["inv-locked"],
    locked: true,
    subjectName: "Locked subject",
    subjectCode: "LOCK101",
  },
  {
    roomId: "room-b",
    slotId: "slot-1",
    chiefInvigilatorId: "chief-stale",
    invigilatorIds: ["inv-stale"],
    locked: false,
    subjectName: "Physics",
    subjectCode: "PHY101",
  },
  {
    roomId: "room-c",
    slotId: "slot-1",
    chiefInvigilatorId: "chief-preserved",
    invigilatorIds: ["inv-preserved"],
    locked: false,
    subjectName: "Chemistry",
    subjectCode: "CHEM101",
  },
];

describe("generateSchedule", () => {
  it("reassigns selected unlocked rooms while preserving locked selections during regeneration", () => {
    const result = generateSchedule({
      roomIds: ["room-a", "room-b"],
      rooms,
      staff,
      day: "Mon",
      slotId: "slot-1",
      existing,
      regenerateUnlocked: true,
    });

    expect(result.conflicts).toHaveLength(0);
    expect(result.assignments).toHaveLength(2);

    expect(result.assignments.find((assignment) => assignment.roomId === "room-a")).toMatchObject({
      chiefInvigilatorId: "chief-locked",
      invigilatorIds: ["inv-locked"],
      locked: true,
    });

    expect(result.assignments.find((assignment) => assignment.roomId === "room-b")).toMatchObject({
      chiefInvigilatorId: "chief-fresh",
      invigilatorIds: ["inv-fresh"],
      locked: false,
      subjectName: "Physics",
      subjectCode: "PHY101",
    });
  });

  it("does not reuse staff who are already booked in an overlapping slot", () => {
    const overlappingAssignments: Assignment[] = [
      {
        roomId: "room-other-a",
        slotId: "slot-2",
        chiefInvigilatorId: "chief-fresh",
        invigilatorIds: ["inv-fresh"],
        locked: false,
      },
      {
        roomId: "room-other-b",
        slotId: "slot-2",
        chiefInvigilatorId: "chief-fresh",
        invigilatorIds: ["inv-stale"],
        locked: false,
      },
    ];

    const result = generateSchedule({
      roomIds: ["room-b"],
      rooms,
      staff,
      day: "Mon",
      slotId: "slot-1",
      existing: [],
      overlappingAssignments,
    });

    expect(result.assignments[0]?.chiefInvigilatorId).not.toBe("chief-fresh");
    expect(result.assignments[0]?.invigilatorIds).not.toContain("inv-fresh");
    expect(result.assignments[0]?.invigilatorIds).not.toContain("inv-stale");
  });
});