import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleGroupSelector } from "./ScheduleGroupSelector";

const setActiveGroupId = vi.fn();
const updateCalls = vi.fn();
const deleteCalls = vi.fn();
const groups = [
  { id: "g1", name: "Finals 2027", description: null, active: true, timeSlotCount: 4, assignmentCount: 12, createdAt: "", updatedAt: "" },
  { id: "g2", name: "test", description: "old", active: true, timeSlotCount: 4, assignmentCount: 0, createdAt: "", updatedAt: "" },
];

vi.mock("@/state/scheduleGroup", () => ({
  useScheduleGroup: () => ({ groups, activeGroup: groups[0], activeGroupId: "g1", isLoading: false, setActiveGroupId }),
}));
vi.mock("@/hooks/useScheduleGroups", () => ({
  useCreateScheduleGroupMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNotifyScheduleGroupMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateScheduleGroupMutation: () => ({ mutateAsync: async (value: unknown) => updateCalls(value), isPending: false }),
  useDeleteScheduleGroupMutation: () => ({ mutateAsync: async (value: unknown) => deleteCalls(value), isPending: false }),
}));
vi.mock("@/hooks/useDemoUser", () => ({ useDemoUser: () => false }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true, canViewEmails: true }) }));
vi.mock("@/lib/unsavedChanges", () => ({ confirmDiscardUnsaved: () => true }));

function openList() {
  render(<MemoryRouter><ScheduleGroupSelector /></MemoryRouter>);
  fireEvent.click(screen.getByRole("combobox", { name: "Schedule group" }));
}

describe("exam period list", () => {
  beforeEach(() => { setActiveGroupId.mockClear(); updateCalls.mockClear(); deleteCalls.mockClear(); });

  it("searches and switches", () => {
    openList();
    fireEvent.change(screen.getByLabelText("Search exam periods"), { target: { value: "tes" } });
    expect(screen.queryByRole("option", { name: /Finals 2027/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /test/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText("test"));
    expect(setActiveGroupId).toHaveBeenCalledWith("g2");
  });

  it("renames, and clears an emptied description", async () => {
    openList();
    fireEvent.click(screen.getByRole("button", { name: "Rename test" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Resits 2027" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateCalls).toHaveBeenCalledWith({ id: "g2", payload: { name: "Resits 2027", description: null, active: true } }));
  });

  it("asks for the name before deleting a period with exam rooms", async () => {
    openList();
    fireEvent.click(screen.getByRole("button", { name: "Delete Finals 2027" }));
    expect(screen.getByText(/its 12 exam rooms/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Delete period" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "Finals 2027" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(deleteCalls).toHaveBeenCalledWith("g1"));
  });

  it("an empty period needs no typing", () => {
    openList();
    fireEvent.click(screen.getByRole("button", { name: "Delete test" }));
    expect(screen.queryByLabelText(/to confirm/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete period" })).toBeEnabled();
  });
});
