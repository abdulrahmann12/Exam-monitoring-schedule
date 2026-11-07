import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Scheduler from "./Scheduler";

const store = vi.hoisted(() => ({ slots: [] as unknown[], rooms: [] as unknown[] }));

vi.mock("@/lib/uniguard/store", () => ({
  useUniGuard: () => ({
    rooms: store.rooms, slots: store.slots, schedule: [], dirtyEntries: [],
    generate: vi.fn(), getEntry: () => undefined, validateEntry: vi.fn(), saveEntry: vi.fn(), isEntryDirty: () => false,
    isLoading: false, error: null, isPersisting: false, isGenerating: false,
  }),
}));
vi.mock("@/state/scheduleGroup", () => ({ useScheduleGroup: () => ({ activeGroupId: "g", activeGroup: { name: "Fall" } }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/uniguard/ScheduleGrid", () => ({ ScheduleGrid: ({ slotId }: { slotId: string }) => <p>grid for {slotId}</p> }));
vi.mock("@/components/uniguard/ExportDialog", () => ({ ExportDialog: () => null }));
vi.mock("@/components/uniguard/BulkScheduleUploadModal", () => ({ BulkScheduleUploadModal: () => null }));

const slot = (id: string, label: string, startTime: string, endTime: string, sortOrder: number) => ({ id, label, startTime, endTime, sortOrder });
const room = (n: number) => ({ id: `r${n}`, name: n === 7 ? "Main Hall" : `Room ${n}`, capacity: 30, minInvigilators: 1 });

describe("scheduler pickers", () => {
  beforeEach(() => {
    store.rooms = [room(1), room(2)];
    store.slots = [slot("am", "Morning", "09:00", "12:00", 1), slot("pm", "Afternoon", "13:00", "16:00", 2)];
  });

  it("shows a few time slots as tabs", () => {
    render(<MemoryRouter><Scheduler /></MemoryRouter>);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    fireEvent.click(screen.getByRole("tab", { name: /Afternoon/ }));
    expect(screen.getByText("grid for pm")).toBeInTheDocument();
  });

  it("switches to a dropdown with arrows when there are many slots, in time order", () => {
    store.slots = [
      slot("am", "Morning", "09:00", "12:00", 1), slot("pm", "Afternoon", "13:00", "16:00", 2),
      ...[1, 2, 3, 4, 5, 6].map((n) => slot(`p${n}`, `Period ${n}`, `${String(6 + n * 2).padStart(2, "0")}:00`, `${String(7 + n * 2).padStart(2, "0")}:30`, 2 + n)),
    ];
    render(<MemoryRouter><Scheduler /></MemoryRouter>);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByText("grid for am")).toBeInTheDocument();
    expect(screen.getByText("2/8")).toBeInTheDocument(); // by start time: Period 1 (08:00), then Morning (09:00)

    fireEvent.click(screen.getByRole("button", { name: "Next time slot" }));
    expect(screen.getByText("3/8")).toBeInTheDocument();
    expect(screen.getByText("grid for p2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose time slot" }));
    const list = screen.getByRole("listbox", { name: "Time slots" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent?.split(/\d/)[0])).toEqual([
      "Period ", "Morning", "Period ", "Period ", "Afternoon", "Period ", "Period ", "Period ",
    ]);
  });

  it("searches long room lists and selects only the matches", () => {
    store.rooms = Array.from({ length: 45 }, (_, index) => room(index + 1));
    render(<MemoryRouter><Scheduler /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /of 45 rooms/ }));
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(screen.getByRole("button", { name: /0 of 45 rooms/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "main" } });
    expect(screen.getByText("1 match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select these" }));
    expect(screen.getByRole("button", { name: /1 of 45 rooms/ })).toBeInTheDocument();
  });
});
