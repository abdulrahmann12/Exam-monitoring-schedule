import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Timeline from "./Timeline";

const permissions = vi.hoisted(() => ({ canEdit: true }));

vi.mock("@/hooks", () => ({ usePermissions: () => permissions }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, title }: { children: React.ReactNode; title: string }) => <div><h1>{title}</h1>{children}</div> }));
vi.mock("@/components/uniguard/ExportDialog", () => ({ ExportDialog: () => null }));
vi.mock("@/components/uniguard/StaffProfileDialog", () => ({ StaffProfileDialog: () => null }));
vi.mock("@/lib/uniguard/store", () => ({
  useUniGuard: () => ({
    isLoading: false,
    error: null,
    studentsPerInvigilator: 0,
    slots: [{ id: "p2", label: "Period 2", startTime: "09:45", endTime: "11:15", sortOrder: 2 }],
    rooms: [
      { id: "lab1", name: "Computer Lab 1", capacity: 25, minInvigilators: 1 },
      { id: "lab2", name: "Computer Lab 2", capacity: 25, minInvigilators: 1 },
      { id: "aud", name: "Engineering Auditorium", capacity: 200, minInvigilators: 4 },
    ],
    staff: [
      { id: "omar", name: "Dr. Omar Nabil", role: "CHIEF_INVIGILATOR" },
      { id: "ahmed", name: "Ahmed Ali", role: "INVIGILATOR" },
      { id: "hana", name: "Hana Mostafa", role: "INVIGILATOR" },
    ],
    schedule: [{
      date: "2026-11-17", slotId: "p2", day: "TUE",
      assignments: [
        { roomId: "lab2", slotId: "p2", chiefInvigilatorId: "omar", invigilatorIds: ["hana"], locked: false },
        { roomId: "lab1", slotId: "p2", chiefInvigilatorId: "omar", invigilatorIds: ["ahmed"], locked: false },
        { roomId: "aud", slotId: "p2", chiefInvigilatorId: null, invigilatorIds: [null, null, null, null], locked: false },
      ],
    }],
  }),
}));

describe("timeline", () => {
  it("groups rooms under their time slot and says clearly what is missing", () => {
    render(<MemoryRouter><Timeline /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByText(/Tuesday, 17 November 2026|Tuesday 17 November 2026|November 17, 2026/)).toBeInTheDocument();
    expect(screen.getAllByText("09:45 – 11:15")).toHaveLength(1); // once per slot, not per room
    expect(screen.getAllByText("covers 2 rooms")).toHaveLength(2);
    expect(screen.getByText("No chief · 4 invigilators missing")).toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Computer Lab 1" })).toHaveAttribute("href", "/scheduler?date=2026-11-17&slot=p2");
  });

  it("can show only the rooms that need staff", () => {
    render(<MemoryRouter><Timeline /></MemoryRouter>);
    fireEvent.click(screen.getByRole("switch", { name: "Only rooms that need staff" }));
    expect(screen.queryByText("Computer Lab 1")).not.toBeInTheDocument();
    expect(screen.getByText("Engineering Auditorium")).toBeInTheDocument();
  });

  it("does not offer editing to viewers", () => {
    permissions.canEdit = false;
    render(<MemoryRouter><Timeline /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /Edit in Scheduler/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Computer Lab 1" })).not.toBeInTheDocument();
    permissions.canEdit = true;
  });
});
