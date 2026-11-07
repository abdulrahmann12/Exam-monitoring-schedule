import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StaffProfileDialog } from "./StaffProfileDialog";

vi.mock("@/lib/uniguard/store", () => ({
  useUniGuard: () => ({
    staff: [{ id: "omar", name: "Dr. Omar Nabil", role: "CHIEF_INVIGILATOR", department: "Exams Office", workingDays: ["Sun"], totalAssignments: 4 }],
    slots: [
      { id: "p2", label: "Period 2", startTime: "09:45", endTime: "11:15" },
      { id: "p3", label: "Period 3", startTime: "11:30", endTime: "13:00" },
    ],
    rooms: [{ id: "l1", name: "Computer Lab 1" }, { id: "l3", name: "Computer Lab 3" }, { id: "l5", name: "Computer Lab 5" }],
    schedule: [
      { date: "2026-11-17", slotId: "p3", day: "TUE", assignments: [{ roomId: "l5", chiefInvigilatorId: null, invigilatorIds: ["omar"], subjectCode: "CS301" }] },
      { date: "2026-11-17", slotId: "p2", day: "TUE", assignments: [
        { roomId: "l3", chiefInvigilatorId: "omar", invigilatorIds: [] },
        { roomId: "l1", chiefInvigilatorId: "omar", invigilatorIds: [] },
      ] },
    ],
  }),
}));

describe("person schedule window", () => {
  it("shows only the schedule, one line per session, rooms of the same time together", () => {
    render(<StaffProfileDialog staffId="omar" open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Dr. Omar Nabil")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && /^2 sessions on 1 day/.test(element.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getByText("Chief · 2 rooms")).toBeInTheDocument();
    expect(screen.getByText("Invigilator")).toBeInTheDocument();
    expect(screen.getByText("· CS301")).toBeInTheDocument();
    // Nothing else: no availability days, no leave form, no internal id.
    expect(screen.queryByText(/Availability/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Leave/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Leave start date/i)).not.toBeInTheDocument();

    const times = screen.getAllByText(/^\d\d:\d\d–\d\d:\d\d$/).map((element) => element.textContent);
    expect(times).toEqual(["09:45–11:15", "11:30–13:00"]);
  });
});
