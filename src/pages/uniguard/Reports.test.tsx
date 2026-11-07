import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Reports from "./Reports";

const person = (personId: string, name: string, role: string, hours: number, department = "Physics") => ({
  personId, name, email: null, department, role, active: true, sessions: hours > 0 ? Math.ceil(hours / 1.5) : 0, hours,
  roomsAsChief: role === "CHIEF_INVIGILATOR" && hours > 0 ? 1 : 0, roomsAsInvigilator: role === "INVIGILATOR" && hours > 0 ? 1 : 0,
  days: hours > 0 ? 1 : 0, firstDuty: null, lastDuty: null,
});

const people = [
  person("c1", "Dr. Omar Nabil", "CHIEF_INVIGILATOR", 19.5, "Exams Office"),
  person("c2", "Dr. Laila Fawzy", "CHIEF_INVIGILATOR", 0, "Exams Office"),
  person("i1", "Sara Hassan", "INVIGILATOR", 6),
  person("i2", "Karim Fathy", "INVIGILATOR", 1.5),
  person("i3", "Mona Adel", "INVIGILATOR", 0),
];

vi.mock("@/hooks/useReports", () => ({
  useWorkloadReportQuery: () => ({ isLoading: false, isError: false, data: { scheduleGroupId: "g", scheduleGroupName: "Fall", staff: 5, sessions: 19, hours: 27, people } }),
  useAnalyticsQuery: () => ({
    isLoading: false, isError: false,
    data: {
      scheduleGroupId: "g", scheduleGroupName: "Fall",
      fairness: [
        { role: "CHIEF_INVIGILATOR", staff: 2, withoutDuty: 1, minHours: 0, averageHours: 9.75, maxHours: 19.5, score: 22 },
        { role: "INVIGILATOR", staff: 3, withoutDuty: 1, minHours: 0, averageHours: 2.5, maxHours: 6, score: 40 },
      ],
      departments: [
        { department: "Physics", staff: 3, sessions: 5, hours: 7.5, hoursPerPerson: 2.5, shareOfHours: 28 },
        { department: "Exams Office", staff: 2, sessions: 13, hours: 19.5, hoursPerPerson: 9.75, shareOfHours: 72 },
      ],
      coverage: { examRooms: 10, fullyStaffed: 8, withGaps: 2, missingInvigilators: 1, missingChiefs: 1, gaps: [
        { assignmentId: "a", examDate: "2026-11-10", slot: "Period 5", room: "Computer Lab 7", subject: "", requiredInvigilators: 1, assignedInvigilators: 0, chiefMissing: true },
      ] },
    },
  }),
}));
vi.mock("@/hooks", () => ({
  useAssignmentsQuery: () => ({ isPending: false, data: { items: [
    { examDate: "2026-11-10", chiefInvigilatorId: "c1", invigilators: [{ required: true, invigilatorId: "i1" }] },
    { examDate: "2026-11-10", chiefInvigilatorId: null, invigilators: [{ required: true, invigilatorId: null }] },
    { examDate: "2026-11-11", chiefInvigilatorId: "c1", invigilators: [] },
  ] } }),
}));
vi.mock("@/state/scheduleGroup", () => ({ useScheduleGroup: () => ({ activeGroupId: "g", activeGroup: { name: "Fall" } }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  return render(<MemoryRouter><Reports /></MemoryRouter>);
}

describe("reports", () => {
  it("opens on an overview with the key numbers and what to fix", () => {
    renderPage();
    expect(screen.getByText("Exam days").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Staff used").parentElement).toHaveTextContent("3 of 5");
    expect(screen.getAllByText("80%")).toHaveLength(2); // the card and the staffing panel
    expect(screen.getByText(/1 room without a chief/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fix in the Timeline/ })).toHaveAttribute("href", "/timeline");
  });

  it("explains fairness in plain words and lists who has no duty", () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Workload/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Workload/ }));
    expect(screen.getByText((_, element) => element?.tagName === "P" && /The busiest 1 of 3 invigilators do 80% of the hours/.test(element.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getByText("No duty yet (1)")).toBeInTheDocument();
    expect(screen.getByText("Mona Adel")).toBeInTheDocument();
  });

  it("lists hours for finance, busiest first, hiding people without duties", () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Hours per person" }));
    fireEvent.click(screen.getByRole("tab", { name: "Hours per person" }));
    const table = screen.getByRole("table");
    const names = within(table).getAllByRole("row").slice(1, -1).map((row) => row.querySelector("td")?.textContent);
    expect(names).toEqual(["Dr. Omar Nabil", "Sara Hassan", "Karim Fathy"]);
    expect(within(table).getByText("Total (3 people)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Hide people without duties" }));
    expect(within(screen.getByRole("table")).getByText("Total (5 people)")).toBeInTheDocument();
  });
});
