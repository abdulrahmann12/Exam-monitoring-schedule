import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TimeSlotsPage from "./TimeSlots";

const deactivate = vi.fn().mockResolvedValue({});
const activate = vi.fn().mockResolvedValue({});
const create = vi.fn().mockResolvedValue({});
const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false });
const slot = (id: string, label: string, startTime: string, endTime: string, sortOrder: number, active = true) =>
  ({ id, label, startTime, endTime, sortOrder, active, createdAt: "", updatedAt: "" });

vi.mock("@/hooks", () => ({
  useTimeSlotsQuery: () => ({
    isPending: false, isError: false,
    data: { items: [
      slot("m", "Morning", "09:00:00", "12:00:00", 1),
      slot("p1", "Period 1", "08:00:00", "09:30:00", 3),
      slot("p3", "Period 3", "11:30:00", "13:00:00", 5),
      slot("old", "Evening", "18:00:00", "20:00:00", 9, false),
    ] },
  }),
  useCreateTimeSlotMutation: () => mutation(create),
  useUpdateTimeSlotMutation: () => mutation(),
  useDeactivateTimeSlotMutation: () => mutation(deactivate),
  useActivateTimeSlotMutation: () => mutation(activate),
  useDeleteTimeSlotMutation: () => mutation(),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name: `Actions for ${name}` });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("time slots page", () => {
  it("lists slots in time order, without seconds, with length and overlaps", () => {
    render(<TimeSlotsPage />);
    const times = screen.getAllByText(/^\d\d:\d\d – \d\d:\d\d$/).map((element) => element.textContent);
    expect(times).toEqual(["08:00 – 09:30", "09:00 – 12:00", "11:30 – 13:00", "18:00 – 20:00"]);
    expect(screen.getByText("Overlaps Period 1, Period 3")).toBeInTheDocument();
    expect(screen.getAllByText("3 h").length).toBeGreaterThan(0);
  });

  it("asks before deactivating, and can activate an inactive slot again", async () => {
    render(<TimeSlotsPage />);
    openMenu("Morning");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Deactivate/ }));
    expect(deactivate).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/activate it again later/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith("m"));

    fireEvent.click(screen.getByRole("button", { name: /Activate/ }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith("old"));
  });

  it("refuses an end before the start, and gives a new slot the next order", async () => {
    render(<TimeSlotsPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /Add time slot/ })[0]);
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "14:00" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "13:00" } });
    expect(screen.getByText("The end must be after the start.")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Add time slot" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "15:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add time slot" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ label: undefined, startTime: "14:00:00", endTime: "15:30:00", sortOrder: 10 }));
  });
});
