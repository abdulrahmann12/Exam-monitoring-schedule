import { describe, expect, it } from "vitest";

import type { AllocatedExam, AllocationSitting, Room, RoomAllocationPreview } from "@/api";

import { checkDrop, movingGroup } from "./dropCheck";

const room = (id: string, capacity: number, extra: Partial<Room> = {}): Room => ({
  id, name: id, capacity, type: "MEDIUM", minInvigilators: 1, hallGender: "MIXED", active: true,
  roomCategoryId: null, roomCategoryName: "Classroom", roomCategorySpecial: false, building: "A",
  createdAt: "", updatedAt: "", ...extra,
});
const ROOMS = [
  room("A1", 60), room("A2", 40), room("B1", 50, { building: "B" }),
  room("LAB1", 30, { roomCategoryName: "Lab", roomCategorySpecial: true }),
  room("F1", 40, { hallGender: "FEMALE" }),
  room("C1", 50, { building: "C" }), room("S1", 10, { building: "C" }),
];
const exam = (row: number, code: string, students: number, rooms: [string, number][], extra: Partial<AllocatedExam> = {}): AllocatedExam => ({
  row, subjectName: null, subjectCode: code, students, roomType: null, freeOfType: null, timeChosen: false, edited: false,
  gender: null, mixedHalls: false, unplaced: 0, hints: [],
  rooms: rooms.map(([id, seated]) => ({ roomId: id, name: id, capacity: ROOMS.find((r) => r.id === id)!.capacity, students: seated })),
  ...extra,
});
const morning: AllocationSitting = {
  date: "2027-01-10", day: "Sunday", time: "09:00–11:00", timeSlotId: "s1", freeRooms: 5,
  exams: [
    exam(2, "X", 80, [["A1", 60], ["A2", 20]]),
    exam(3, "LABEX", 20, [["LAB1", 20]], { roomType: "Lab" }),
    exam(5, "SPLIT", 30, [["B1", 30]], { gender: "Male" }),
    exam(6, "SPLIT", 20, [["F1", 20]], { gender: "Female" }),
  ],
};
const noon: AllocationSitting = {
  date: "2027-01-10", day: "Sunday", time: "12:00–13:00", timeSlotId: "s2", freeRooms: 5,
  exams: [exam(4, "Y", 40, [["B1", 40]])],
};
const preview: RoomAllocationPreview = {
  exams: 5, examsFullySeated: 5, students: 190, studentsUnplaced: 0, roomsUsed: 6, seats: 0, emptySeats: 0,
  sittings: [morning, noon], warnings: [], timeSlotsToCreate: [], columnsRecognised: [],
  booked: [{ date: "2027-01-10", time: "12:00–13:00", roomId: "A2", label: "Booked: OLD" }],
};
const X = morning.exams[0];

describe("drop rules", () => {
  it("same time, another room: swaps only that room", () => {
    const swap = checkDrop(preview, ROOMS, { exam: X, sitting: morning, fromRoomId: "A2" }, { date: "2027-01-10", time: "09:00–11:00", roomId: "C1" });
    expect(swap.ok).toBe(true);
    expect(swap.swapRooms).toEqual(["A1", "C1"]);
    // A room another exam uses at that time is refused.
    const used = checkDrop(preview, ROOMS, { exam: X, sitting: morning, fromRoomId: "A2" }, { date: "2027-01-10", time: "09:00–11:00", roomId: "B1" });
    expect(used).toMatchObject({ ok: false });
    expect(used.reason).toContain("in use by SPLIT");
    // Too few seats after the swap: refused.
    const small = checkDrop(preview, ROOMS, { exam: X, sitting: morning, fromRoomId: "A1" }, { date: "2027-01-10", time: "09:00–11:00", roomId: "S1" });
    expect(small.ok).toBe(false);
    expect(small.reason).toContain("50 seats for 80 students");
  });

  it("another time: the whole exam moves, if there are seats for everyone", () => {
    const header = checkDrop(preview, ROOMS, { exam: X, sitting: morning, fromRoomId: "A1" }, { date: "2027-01-10", time: "12:00–13:00" });
    expect(header.ok).toBe(true); // A1, F1, C1, S1 free at noon (A2 booked, B1 used, LAB1 is a lab)
    const booked = checkDrop(preview, ROOMS, { exam: X, sitting: morning, fromRoomId: "A1" }, { date: "2027-01-10", time: "12:00–13:00", roomId: "A2" });
    expect(booked.reason).toContain("Booked: OLD");
    const big = { ...X, students: 300 };
    const bigSitting = { ...morning, exams: [big, ...morning.exams.slice(1)] };
    const tooBig = checkDrop(preview, ROOMS, { exam: big, sitting: bigSitting, fromRoomId: "A1" }, { date: "2027-01-10", time: "15:00–16:00" });
    expect(tooBig.ok).toBe(false);
    expect(tooBig.reason).toContain("only 250 seats"); // all non-lab rooms: 60 + 40 + 50 + 40 + 50 + 10
  });

  it("checks the room type and the hall gender", () => {
    const labExam = morning.exams[1];
    const notLab = checkDrop(preview, ROOMS, { exam: labExam, sitting: morning, fromRoomId: "LAB1" }, { date: "2027-01-10", time: "12:00–13:00", roomId: "A1" });
    expect(notLab.reason).toContain("needs a “Lab” room");
    const normalInLab = checkDrop(preview, ROOMS, { exam: noon.exams[0], sitting: noon, fromRoomId: "B1" }, { date: "2027-01-10", time: "12:00–13:00", roomId: "LAB1" });
    expect(normalInLab.reason).toContain("only for exams that ask for it");
    const men = morning.exams[2];
    const femaleHall = checkDrop(preview, ROOMS, { exam: men, sitting: morning, fromRoomId: "B1" }, { date: "2027-01-10", time: "12:00–13:00", roomId: "F1" });
    expect(femaleHall.reason).toContain("Female hall");
  });

  it("men and women of one subject move together", () => {
    expect(movingGroup({ exam: morning.exams[2], sitting: morning, fromRoomId: "B1" }).map((e) => e.row)).toEqual([5, 6]);
  });

  it("an exam already short of seats may move where it is no worse", () => {
    const short = { ...X, students: 180, unplaced: 30 }; // 150 seated now
    const shortSitting = { ...morning, exams: [short, ...morning.exams.slice(1)] };
    const ok = checkDrop(preview, ROOMS, { exam: short, sitting: shortSitting, fromRoomId: "A1" }, { date: "2027-01-10", time: "12:00–13:00" });
    expect(ok.ok).toBe(true); // 160 free seats at noon: at least as many as now
    const worse = checkDrop(preview, ROOMS, { exam: { ...short, unplaced: 0 }, sitting: { ...morning, exams: [{ ...short, unplaced: 0 }, ...morning.exams.slice(1)] },
      fromRoomId: "A1" }, { date: "2027-01-10", time: "12:00–13:00" });
    expect(worse.ok).toBe(false); // all 180 seated now, only 160 seats at noon
  });
});
