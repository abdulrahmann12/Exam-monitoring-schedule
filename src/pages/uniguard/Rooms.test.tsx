import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Rooms from "./Rooms";

const remove = vi.fn().mockResolvedValue(undefined);
const update = vi.fn().mockResolvedValue(undefined);
const create = vi.fn().mockResolvedValue(undefined);
const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false });

const rooms = [
  ...Array.from({ length: 30 }, (_, index) => ({ id: `r${index + 1}`, name: `Room ${index + 1}`, capacity: 30 + index, type: "MEDIUM", minInvigilators: 1, hallGender: "MIXED", active: true, roomCategoryId: "t-class", roomCategoryName: "Classroom", roomCategorySpecial: false, building: index < 15 ? "A" : "B" })),
  { id: "hd", name: "Hall D", capacity: 120, type: "LARGE", minInvigilators: 3, hallGender: "FEMALE", active: false, roomCategoryId: "t-class", roomCategoryName: "Classroom", roomCategorySpecial: false, building: null },
  { id: "lab", name: "Computer Lab 1", capacity: 20, type: "SMALL", minInvigilators: 1, hallGender: "MIXED", active: true, roomCategoryId: "t-pc", roomCategoryName: "Computer Lab", roomCategorySpecial: true, building: "C" },
];

vi.mock("@/hooks", () => ({
  useRoomsQuery: () => ({ isLoading: false, isError: false, data: { items: rooms } }),
  useCreateRoomMutation: () => mutation(create),
  useUpdateRoomMutation: () => mutation(update),
  useDeleteRoomMutation: () => mutation(remove),
  useUploadRoomsBulkMutation: () => mutation(),
  useDownloadRoomsTemplateMutation: () => mutation(),
}));
const categories = [
  { id: "t-class", name: "Classroom", special: false, sortOrder: 1, rooms: 31 },
  { id: "t-pc", name: "Computer Lab", special: true, sortOrder: 2, rooms: 1 },
];
vi.mock("@/hooks/useRoomCategories", () => ({
  useRoomCategoriesQuery: () => ({ isLoading: false, data: categories }),
  useCreateRoomCategoryMutation: () => mutation(),
  useUpdateRoomCategoryMutation: () => mutation(),
  useDeleteRoomCategoryMutation: () => mutation(),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

async function openActions(name: string) {
  const trigger = screen.getByRole("button", { name: `Actions for ${name}` });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

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

  it("shows room types and rooms out of service", () => {
    render(<Rooms />);
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "lab" } });
    expect(screen.getByText("Computer Lab")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "hall d" } });
    expect(screen.getByText("Out of service")).toBeInTheDocument();
  });

  it("puts a room out of service and back, keeping its other settings", async () => {
    render(<Rooms />);
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "lab" } });
    await openActions("Computer Lab 1");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Out of service/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({
      id: "lab",
      payload: { name: "Computer Lab 1", capacity: 20, type: "SMALL", minInvigilators: 1, hallGender: "MIXED", active: false },
    }));

    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "hall d" } });
    await openActions("Hall D");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Back in service/ }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: "hd", payload: expect.objectContaining({ active: true }) })));
  });

  it("a new room gets its type from the name unless one is chosen", async () => {
    render(<Rooms />);
    fireEvent.click(screen.getByRole("button", { name: /Add room/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Automatic \(from the name/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("Hall A"), { target: { value: "Physics Lab 2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save room" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Physics Lab 2", active: true })));
    expect(create.mock.calls.at(-1)?.[0].roomCategoryId).toBeUndefined(); // the server picks Lab from the name
  });

  it("keeps the room type when a room is edited", async () => {
    render(<Rooms />);
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "computer" } });
    fireEvent.click(screen.getByRole("button", { name: "Computer Lab 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Only given to exams that ask for “Computer Lab”/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save room" }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: "lab", payload: expect.objectContaining({ roomCategoryId: "t-pc" }) })));
  });

  it("filters by building and keeps the building when a room is edited", async () => {
    render(<Rooms />);
    fireEvent.change(screen.getByLabelText("Search rooms"), { target: { value: "computer" } });
    expect(screen.getByRole("cell", { name: "C" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Computer Lab 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Building")).toHaveValue("C");
    fireEvent.change(within(dialog).getByLabelText("Building"), { target: { value: "D" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save room" }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: "lab", payload: expect.objectContaining({ building: "D" }) })));
  });

  it("shows the building guessed from a new room's name", async () => {
    render(<Rooms />);
    fireEvent.click(screen.getByRole("button", { name: /Add room/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Hall A"), { target: { value: "H101" } });
    expect(within(dialog).getByLabelText("Building")).toHaveAttribute("placeholder", "H");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save room" }));
    await waitFor(() => expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ name: "H101" })));
    expect(create.mock.calls.at(-1)?.[0].building).toBeUndefined(); // the server takes it from the name
  });
});
