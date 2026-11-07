import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UniGuardProvider, useUniGuard } from "./store";

const page = (items: unknown[]) => ({ success: true, error: null, data: { items, page: 0, size: 100, totalItems: items.length, totalPages: 1 } });

const person = (id: string, role: string) => ({ id, name: id, role, department: "CS", availableDays: ["SUN"], totalAssignments: 1, maxParallelRooms: 1 });

vi.mock("@/services", () => ({
  peopleService: { getPeople: async () => page([person("chief", "CHIEF_INVIGILATOR"), person("inv1", "INVIGILATOR"), person("inv2", "INVIGILATOR")]) },
  roomsService: { getRooms: async () => page([{ id: "hall", name: "Hall A", capacity: 80, minInvigilators: 2 }]) },
  timeSlotsService: { getTimeSlots: async () => page([{ id: "morning", label: "Morning", sortOrder: 1, startTime: "09:00:00", endTime: "12:00:00" }]) },
  assignmentsService: {
    getAssignments: async () => page([{
      id: "a1", examDate: "2026-11-15", roomId: "hall", roomName: "Hall A", timeSlotId: "morning", slotLabel: "Morning",
      startTime: "09:00:00", endTime: "12:00:00", subjectName: null, subjectCode: null, chiefInvigilatorId: "chief", chiefInvigilatorName: "chief",
      locked: false, generationVersion: 1, source: "MANUAL", createdAt: "", updatedAt: "",
      invigilators: [
        { id: "i1", invigilatorId: "inv1", invigilatorName: "inv1", positionIndex: 0, required: true, createdAt: "" },
        { id: "i2", invigilatorId: "inv2", invigilatorName: "inv2", positionIndex: 1, required: true, createdAt: "" },
      ],
    }]),
  },
}));
vi.mock("@/state/scheduleGroup", () => ({ useScheduleGroup: () => ({ activeGroupId: "g1", error: null, isLoading: false }) }));
vi.mock("@/hooks/useSettings", () => ({ useSettingsQuery: () => ({ data: { studentsPerInvigilator: 0 } }) }));

describe("scheduler store", () => {
  it("clears the chief and every invigilator of a room in one change", async () => {
    let store: ReturnType<typeof useUniGuard> | null = null;
    function Probe() {
      store = useUniGuard();
      return null;
    }
    render(<QueryClientProvider client={new QueryClient()}><UniGuardProvider><Probe /></UniGuardProvider></QueryClientProvider>);

    await waitFor(() => expect(store?.getEntry("2026-11-15", "morning")?.assignments[0].invigilatorIds).toEqual(["inv1", "inv2"]));
    expect(store!.dirtyEntries).toEqual([]);

    act(() => store!.clearRoom("2026-11-15", "morning", "hall"));

    const room = store!.getEntry("2026-11-15", "morning")!.assignments[0];
    expect(room.chiefInvigilatorId).toBeNull();
    expect(room.invigilatorIds).toEqual([null, null]); // all of them, not only the last one
    expect(store!.dirtyEntries).toEqual([{ date: "2026-11-15", slotId: "morning" }]);
  });
});
