import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AssignmentsPage from "./Assignments";

const removeOne = vi.fn().mockResolvedValue(undefined);
const clearAll = vi.fn().mockResolvedValue({ deleted: 3, examPeriod: "Fall 2026" });
const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false, getIsPending: () => false, getIsLocked: () => false });

const seat = (invigilatorId: string | null, name: string | null = invigilatorId) => ({ id: `s-${invigilatorId}`, invigilatorId, invigilatorName: name, positionIndex: 0, required: true, createdAt: "" });
const exam = (id: string, roomName: string, extra: object = {}) => ({
  id, examDate: "2026-11-10", roomId: id, roomName, timeSlotId: "p5", slotLabel: "Period 5", startTime: "15:00:00", endTime: "16:30:00",
  subjectName: null, subjectCode: null, chiefInvigilatorId: "c", chiefInvigilatorName: "Dr. Laila Fawzy", locked: false, generationVersion: 1,
  source: "GENERATED", invigilators: [seat("i1", "Sara Hassan")], createdAt: "", updatedAt: "", ...extra,
});

vi.mock("@/hooks", () => ({
  useAssignmentsQuery: () => ({
    isPending: false, isError: false,
    data: { items: [
      exam("a2", "Computer Lab 2"),
      exam("a1", "Computer Lab 1", { subjectName: "Algorithms", subjectCode: "CS301", locked: true }),
      exam("a3", "Computer Lab 10", { chiefInvigilatorId: null, chiefInvigilatorName: null, invigilators: [seat(null, null)] }),
    ] },
  }),
  usePeopleQuery: () => ({ isLoading: false, isError: false, data: { items: [] } }),
  useRoomsQuery: () => ({ isLoading: false, isError: false, data: { items: [{ id: "a1", name: "Computer Lab 1" }] } }),
  useTimeSlotsQuery: () => ({ isPending: false, isError: false, data: { items: [
    { id: "p1", label: "Period 1", startTime: "08:00:00", endTime: "09:30:00", sortOrder: 3, active: true },
    { id: "p5", label: "Period 5", startTime: "15:00:00", endTime: "16:30:00", sortOrder: 7, active: true },
  ] } }),
  useCreateAssignmentMutation: () => mutation(),
  useUpdateAssignmentMutation: () => mutation(),
  useDeleteAssignmentMutation: () => mutation(removeOne),
  useDeleteAllAssignmentsMutation: () => mutation(clearAll),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/state/scheduleGroup", () => ({ useScheduleGroup: () => ({ error: null, isLoading: false, refetch: vi.fn(), activeGroup: { name: "Fall 2026" } }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function openMenu(name: RegExp | string) {
  const trigger = screen.getByRole("button", { name });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("assignments page", () => {
  it("shows clean rows in natural order, with the time, the lock and what is missing", () => {
    render(<AssignmentsPage />);
    const rooms = screen.getAllByRole("button", { name: /^Actions for/ }).map((button) => button.getAttribute("aria-label"));
    expect(rooms).toEqual(["Actions for Computer Lab 1 on 2026-11-10", "Actions for Computer Lab 2 on 2026-11-10", "Actions for Computer Lab 10 on 2026-11-10"]);
    expect(screen.getAllByText("15:00–16:30").length).toBe(3);
    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
    expect(screen.getByText(/No chief · 1 invigilator missing/)).toBeInTheDocument();
    expect(screen.queryByText(/Unlabeled subject|No subject code|GENERATED|Unlocked/)).not.toBeInTheDocument();
  });

  it("offers only the time slots that have exams", async () => {
    render(<AssignmentsPage />);
    const slotSelect = screen.getByRole("combobox", { name: "Time slot" });
    slotSelect.focus();
    fireEvent.keyDown(slotSelect, { key: "Enter" });
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual(["All time slots", "15:00–16:30 · Period 5 (3)"]); // Period 1 has no exams: not offered
  });

  it("filters by room on screen, listing only rooms with exams", async () => {
    render(<AssignmentsPage />);
    const roomSelect = screen.getByRole("combobox", { name: "Room" });
    roomSelect.focus();
    fireEvent.keyDown(roomSelect, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: /Computer Lab 10/ }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Actions for/, hidden: true })).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Actions for Computer Lab 10 on 2026-11-10", hidden: true })).toBeInTheDocument();
  });

  it("filters to rooms that need staff", () => {
    render(<AssignmentsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Needs staff/ }));
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(1);
  });

  it("asks before deleting one row", async () => {
    render(<AssignmentsPage />);
    openMenu("Actions for Computer Lab 2 on 2026-11-10");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(removeOne).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(removeOne).toHaveBeenCalledWith("a2"));
  });

  it("deletes a whole exam period only after its name is typed", async () => {
    render(<AssignmentsPage />);
    openMenu("More actions");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete all of Fall 2026/ }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete all" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Type .* to confirm/), { target: { value: "Fall" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Type .* to confirm/), { target: { value: "Fall 2026" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(clearAll).toHaveBeenCalledTimes(1));
  });
});
