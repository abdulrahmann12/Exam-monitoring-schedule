import { describe, expect, it } from "vitest";

import type { RoomAllocationPreview } from "@/api";

import { base64ToFile, clearDraft, fileToBase64, loadDraft, planChanges, saveDraft } from "./allocationDraft";

const plan = (time: string, rooms: string[], unplaced = 0): RoomAllocationPreview => ({
  exams: 1, examsFullySeated: unplaced ? 0 : 1, students: 100, studentsUnplaced: unplaced, roomsUsed: rooms.length, seats: 100, emptySeats: 0,
  sittings: [{ date: "2027-01-10", day: "Sunday", time, timeSlotId: null, freeRooms: 4, exams: [{
    row: 2, subjectName: "Calculus", subjectCode: "MATH101", students: 100, roomType: null, freeOfType: null, timeChosen: false, edited: false,
    gender: null, mixedHalls: false, unplaced, hints: [], rooms: rooms.map((name) => ({ roomId: name, name, capacity: 50, students: 50 })),
  }] }],
  warnings: [], timeSlotsToCreate: [], columnsRecognised: [], booked: [],
});

describe("room allocation draft", () => {
  it("finds what changed between the preview and the saved plan", () => {
    expect(planChanges(plan("09:00–11:00", ["A", "B"]), plan("09:00–11:00", ["B", "A"]))).toEqual([]); // same rooms, other order
    expect(planChanges(plan("09:00–11:00", ["A", "B"]), plan("09:00–11:00", ["A", "C"])))
      .toEqual(["Row 2 MATH101: rooms A, B → A, C"]);
    expect(planChanges(plan("09:00–11:00", ["A"]), plan("12:00–14:00", ["A"])))
      .toEqual(["Row 2 MATH101: time 2027-01-10 09:00–11:00 → 2027-01-10 12:00–14:00"]);
    expect(planChanges(plan("09:00–11:00", ["A", "B"]), plan("09:00–11:00", ["A", "B"], 20)))
      .toEqual(["Row 2 MATH101: students without a seat 0 → 20"]);
  });

  it("keeps the file and the proposal per exam period", async () => {
    const original = new File([new Uint8Array([0, 1, 2, 250, 255])], "exams.xlsx", { type: "application/octet-stream" });
    const base64 = await fileToBase64(original);
    saveDraft("g1", { fileName: "exams.xlsx", fileType: original.type, fileBase64: base64, dateOrder: "AUTO", preview: plan("09:00–11:00", ["A"]), saved: null, staffed: null });

    const draft = loadDraft("g1");
    expect(draft?.fileName).toBe("exams.xlsx");
    const restored = base64ToFile(draft!.fileBase64, draft!.fileName, draft!.fileType);
    expect(await fileToBase64(restored)).toBe(base64); // same bytes back
    expect(atob(base64).split("").map((c) => c.charCodeAt(0))).toEqual([0, 1, 2, 250, 255]);
    expect(loadDraft("g2")).toBeNull(); // another exam period has its own

    clearDraft("g1");
    expect(loadDraft("g1")).toBeNull();
  });
});
