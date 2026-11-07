import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Rooms from "./Rooms";

const remove = vi.fn().mockResolvedValue(undefined);
const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false });

const rooms = [
  ...Array.from({ length: 30 }, (_, index) => ({ id: `r${index + 1}`, name: `Room ${index + 1}`, capacity: 30 + index, type: "MEDIUM", minInvigilators: 1, hallGender: "MIXED" })),
  { id: "hd", name: "Hall D", capacity: 120, type: "LARGE", minInvigilators: 3, hallGender: "FEMALE" },
  { id: "lab", name: "Computer Lab 1", capacity: 20, type: "SMALL", minInvigilators: 1, hallGender: "MIXED" },
];

vi.mock("@/hooks", () => ({
  useRoomsQuery: () => ({ isLoading: false, isError: false, data: { items: rooms } }),
  useCreateRoomMutation: () => mutation(),
  useUpdateRoomMutation: () => mutation(),
  useDeleteRoomMutation: () => mutation(remove),
  useUploadRoomsBulkMutation: () => mutation(),
  useDownloadRoomsTemplateMutation: () => mutation(),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rowsShown = () => screen.getAllByRole("button", { name: /^Actions for/ }).length;

describe("rooms page", () => {
  it("pages long lists, in natural order", () => {
    render(<Rooms />);
    expect(rowsShown()).toBe(25);
    expect(screen.getByText("1–25")).toBeInTheDocument();
    expect(screen.queryByText("Room 30")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(rowsShown()).toBe(7);
    expect(screen.getByText("Room 30")).toBeInTheDocument(); // "Room 10" after "Room 9", not after "Room 1"
  });

  it("searches and filters, starting again on page 1", () => {
    render(<Rooms />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "lab" } });
    expect(rowsShown()).toBe(1);
    expect(screen.getByText("Computer Lab 1")).toBeInTheDocument();
    expect(screen.getByText(/filtered from 32/)).toBeInTheDocument();
  });

  it("asks before deleting a room", async () => {
    render(<Rooms />);
    const trigger = screen.getByRole("button", { name: "Actions for Computer Lab 1" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(remove).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("lab"));
  });
});
