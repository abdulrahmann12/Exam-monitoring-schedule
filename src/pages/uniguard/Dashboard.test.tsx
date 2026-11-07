import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./Dashboard";

const data = vi.hoisted(() => ({ people: [] as unknown[], rooms: [] as unknown[], assignments: [] as unknown[], slots: [] as unknown[] }));

const query = (items: unknown[]) => ({ data: { items, totalItems: items.length }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() });

vi.mock("@/hooks", () => ({
  usePeopleQuery: () => query(data.people),
  useRoomsQuery: () => query(data.rooms),
  useAssignmentsQuery: () => query(data.assignments),
  useTimeSlotsQuery: () => query(data.slots),
  usePermissions: () => ({ canEdit: true }),
}));
vi.mock("@/state/scheduleGroup", () => ({
  useScheduleGroup: () => ({ error: null, isLoading: false, refetch: vi.fn(), activeGroup: { name: "Fall 2026" } }),
}));
vi.mock("@/components/uniguard/AppLayout", () => ({
  AppLayout: ({ children, subtitle }: { children: React.ReactNode; subtitle: string }) => <div><p>{subtitle}</p>{children}</div>,
}));

const person = (id: string, role: string, totalAssignments = 0) => ({ id, name: `Person ${id}`, role, department: "CS", availableDays: [], totalAssignments });
const future = new Date(Date.now() + 2 * 86400000);
const futureDay = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;

describe("dashboard", () => {
  beforeEach(() => {
    data.people = [];
    data.rooms = [];
    data.assignments = [];
    data.slots = [];
  });

  it("guides a new university through the setup steps", () => {
    data.rooms = [{ id: "r", minInvigilators: 2 }];
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 done. Each step unlocks the next.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add people/ })).toHaveAttribute("href", "/people");
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
    expect(screen.getByText(/Fall 2026/)).toBeInTheDocument();
  });

  it("shows staffing gaps and upcoming exams once set up", () => {
    data.rooms = [{ id: "r", minInvigilators: 1 }];
    data.people = [person("c", "CHIEF_INVIGILATOR", 3), person("i", "INVIGILATOR", 1)];
    data.slots = [{ id: "s", label: "Morning" }];
    data.assignments = [{
      id: "a", examDate: futureDay, roomName: "Hall A", slotLabel: "Morning", startTime: "09:00:00", endTime: "11:00:00",
      subjectName: "Physics", subjectCode: "P1", chiefInvigilatorId: null, invigilators: [],
    }];
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("No chief")).toBeInTheDocument();
    expect(screen.getByText("Physics")).toBeInTheDocument();
    expect(screen.getByText("Needs staff")).toBeInTheDocument();
    expect(screen.getByText("Person c")).toBeInTheDocument();
  });
});
