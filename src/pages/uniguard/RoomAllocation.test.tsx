import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api";
import { roomAllocationService } from "@/api/services/roomAllocationService";

import { MemoryRouter } from "react-router-dom";

import { toast } from "sonner";

import RoomAllocation from "./RoomAllocation";

/** Records the calls. A plain function gives the answer: a rejecting vi.fn is reported as a test error even when handled. */
const mutateAsync = vi.fn();
let answer: () => Promise<unknown> = async () => undefined;
const saveCalls = vi.fn();
const undoCalls = vi.fn();
let batches: unknown[] = [];
const staffCalls = vi.fn();

vi.mock("@/hooks/useRoomAllocation", () => ({
  usePreviewRoomAllocationMutation: () => ({
    mutateAsync: (variables: unknown) => { mutateAsync(variables); return answer(); },
    isPending: false,
  }),
  useSaveRoomAllocationMutation: () => ({
    mutateAsync: async (variables: unknown) => {
      saveCalls(variables);
      // Between preview and save someone booked "Room 50": the saved plan uses "Room 40" instead.
      const plan = JSON.parse(JSON.stringify(preview));
      plan.sittings[0].exams[0].rooms[2].name = "Room 40";
      return { batchId: "b1", roomAssignmentsCreated: 4, assignmentIds: ["a1", "a2", "a3", "a4"], examsSaved: 2, examsIncomplete: 1,
        studentsUnplaced: 90, timeSlotsCreated: ["Exam 09:00–11:00"], warnings: [], firstDate: "2027-01-10", plan };
    },
    isPending: false,
  }),
  useRoomAllocationBatchesQuery: () => ({ data: batches }),
  useUndoRoomAllocationMutation: () => ({
    mutateAsync: async (id: string) => { undoCalls(id); return { batchId: id, fileName: "exams.csv", examRoomsDeleted: 4 }; },
    isPending: false,
  }),
  useStaffRoomAllocationMutation: () => ({
    mutateAsync: async (variables: unknown) => {
      staffCalls(variables);
      return { examRooms: 4, alreadyStaffed: 0, chiefSlotsTotal: 4, chiefSlotsFilled: 4, invigilatorSlotsTotal: 9, invigilatorSlotsFilled: 8,
        warnings: ["1 invigilator seat(s) could not be filled for room 'Room 50' on 2027-01-10 (09:00–11:00)."],
        hints: ["10 Jan 09:00–11:00: 1 invigilator seat empty. Of 61 invigilators, 12 don't work on Sunday. Add Sunday to some of them (People page)."] };
    },
    isPending: false,
  }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomsQuery: () => ({ data: { items: [
    { id: "r1", name: "Hall 100", capacity: 100, active: true, building: "H" },
    { id: "r2", name: "Room 60", capacity: 60, active: true, building: "R" },
    { id: "r3", name: "Room 50", capacity: 50, active: true, building: "R" },
    { id: "r9", name: "Spare 30", capacity: 30, active: true, building: "R" },
    { id: "r8", name: "Big 400", capacity: 400, active: true, building: "R" },
    { id: "rx", name: "Closed", capacity: 99, active: false, building: "R" },
  ] } }),
}));
vi.mock("@/hooks/useTimeSlots", () => ({
  useTimeSlotsQuery: () => ({ data: { items: [
    { id: "s1", label: "Morning", startTime: "09:00:00", endTime: "11:00:00", sortOrder: 1, active: true },
    { id: "s2", label: "Noon", startTime: "12:00:00", endTime: "13:00:00", sortOrder: 2, active: true },
  ] } }),
}));
vi.mock("@/state/scheduleGroup", () => ({
  useScheduleGroup: () => ({ activeGroupId: "g1", activeGroup: { id: "g1", name: "Finals" } }),
}));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const preview = {
  exams: 2,
  examsFullySeated: 1,
  students: 450,
  studentsUnplaced: 90,
  roomsUsed: 4,
  seats: 360,
  emptySeats: 0,
  sittings: [{
    date: "2027-01-10",
    day: "Sunday",
    time: "09:00–11:00",
    timeSlotId: null,
    freeRooms: 4,
    exams: [
      { row: 2, subjectName: "Calculus I", subjectCode: "MATH101", students: 300, roomType: null, freeOfType: null, timeChosen: false, edited: false, gender: null, mixedHalls: false, unplaced: 90,
        hints: ["Move it to another time on 10 Jan: 12:00–13:00 (5 free rooms, 400 seats) has enough for all 300 students."], rooms: [
        { roomId: "r1", name: "Hall 100", capacity: 100, students: 100 },
        { roomId: "r2", name: "Room 60", capacity: 60, students: 60 },
        { roomId: "r3", name: "Room 50", capacity: 50, students: 50 },
      ] },
      { row: 3, subjectName: null, subjectCode: "PHYS1", students: 150, roomType: "Computer Lab", freeOfType: 1, timeChosen: true, edited: false, gender: "Female", mixedHalls: true, unplaced: 0, hints: [], rooms: [
        { roomId: "r4", name: "Lab 150", capacity: 150, students: 150 },
      ] },
    ],
  }],
  warnings: ["Row 2: not enough free rooms on 2027-01-10 09:00–11:00: 90 of 300 students have no seat."],
  timeSlotsToCreate: ["Exam 09:00–11:00"],
  columnsRecognised: [],
  booked: [{ date: "2027-01-10", time: "12:00–13:00", roomId: "r3", label: "Booked: OLD1" }],
};

function chooseFile(name = "exams.csv") {
  const file = new File(["Date,Time Slot,Code,Students"], name, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("Exam list file"), { target: { files: [file] } });
  return file;
}

describe("room allocation page", () => {
  beforeEach(() => {
    mutateAsync.mockClear(); saveCalls.mockClear(); staffCalls.mockClear(); undoCalls.mockClear();
    answer = async () => undefined;
    batches = [];
    window.localStorage.clear();
  });

  it("uploads the exam list and shows the proposed rooms", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Choose rooms/ })).toBeDisabled();

    const file = chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g1", file, dateOrder: "AUTO" })));

    expect(await screen.findByText("Calculus I")).toBeInTheDocument();
    expect(screen.getByText("Hall 100")).toBeInTheDocument();
    expect(screen.getByText("PHYS1")).toBeInTheDocument(); // code only: shown as the name
    expect(screen.getByText("Computer Lab")).toBeInTheDocument(); // the room type the exam asked for
    expect(screen.getByText("Time chosen")).toBeInTheDocument(); // the file had no time for PHYS1
    expect(screen.getByText("90 without a seat")).toBeInTheDocument(); // the Students tile
    expect(screen.getByText(/not enough free normal rooms/)).toBeInTheDocument(); // the exam's flag
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByText("Female")).toBeInTheDocument(); // the exam's gender
    expect(screen.getByText("Mixed halls")).toBeInTheDocument(); // flag: not enough women's halls
    expect(screen.getByText(/Not enough free Female halls/)).toBeInTheDocument();
    expect(screen.getByText(/Move it to another time on 10 Jan: 12:00–13:00/)).toBeInTheDocument(); // how to fix
    expect(screen.getByText(/90 of 300 students have no seat/)).toBeInTheDocument();
    expect(screen.getByText(/New time slots will be created when you save: Exam 09:00–11:00/)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument(); // exams fully seated
    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
  });

  it("saves the rooms after a warning, then creates the schedule", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    const file = chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save rooms" }));

    // 90 students without a seat: asked first.
    expect(await screen.findByText("Save with students still without a seat?")).toBeInTheDocument();
    expect(saveCalls).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(saveCalls).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g1", file, dateOrder: "AUTO" })));
    expect(await screen.findByText(/4 exam rooms saved, new time slots: Exam 09:00–11:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Scheduler" })).toHaveAttribute("href", "/scheduler?date=2027-01-10");

    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));
    await waitFor(() => expect(staffCalls).toHaveBeenCalledWith({ groupId: "g1", assignmentIds: ["a1", "a2", "a3", "a4"] }));
    expect(await screen.findByText("Chiefs 4/4, invigilators 8/9.")).toBeInTheDocument();
    expect(screen.getByText(/could not be filled for room 'Room 50'/)).toBeInTheDocument();
    expect(screen.getByText(/12 don't work on Sunday/)).toBeInTheDocument(); // staff hint
    expect(screen.queryByRole("button", { name: "Create schedule" })).not.toBeInTheDocument(); // never twice from here
    // The saved plan differs from the preview: shown, so the user can check it.
    expect(screen.getByText(/The saved plan differs from the preview for 1 exam/)).toBeInTheDocument();
    expect(screen.getByText("Row 2 MATH101: rooms Hall 100, Room 50, Room 60 → Hall 100, Room 40, Room 60")).toBeInTheDocument();

    // Undo this save (asks first).
    fireEvent.click(screen.getByRole("button", { name: /Undo this save/ }));
    expect(await screen.findByText("Undo this saved allocation?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo allocation" }));
    await waitFor(() => expect(undoCalls).toHaveBeenCalledWith("b1"));
    expect(await screen.findByRole("button", { name: "Save rooms" })).toBeInTheDocument(); // can save again
  });

  it("brings back the file and the proposal after a page refresh", async () => {
    answer = async () => preview;
    const first = render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    chooseFile("finals.csv");
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    expect(await screen.findByText("Calculus I")).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem("uniguard.roomAllocation.v1.g1")).not.toBeNull());
    first.unmount();

    render(<MemoryRouter><RoomAllocation /></MemoryRouter>); // the page opens again
    expect(await screen.findByText("Calculus I")).toBeInTheDocument();
    expect(screen.getByText("finals.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save rooms" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start over/ }));
    expect(screen.queryByText("Calculus I")).not.toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem("uniguard.roomAllocation.v1.g1")).toBeNull());
  });

  it("downloads door sheets and the Excel file of a saved allocation", async () => {
    const download = vi.spyOn(roomAllocationService, "downloadBatchFile").mockImplementation(async (id, kind) => ({
      success: true, data: { blob: new Blob(["x"]), fileName: kind === "door-sheets" ? "door-sheets-finals.pdf" : "room-allocation-finals.xlsx" },
    }) as never);
    const createUrl = vi.fn(() => "blob:test");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    batches = [
      { id: "old", createdAt: "2027-01-01T10:00:00Z", createdBy: "admin@uni.test", fileName: "december.xlsx", exams: 10, examRooms: 25,
        studentsUnplaced: 0, remaining: 25, undoneAt: null },
    ];
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Door sheets \(PDF\)/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("old", "door-sheets"));
    fireEvent.click(screen.getByRole("button", { name: /^Excel$/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("old", "export"));
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2));
    download.mockRestore();
  });

  it("lists earlier saves with Undo", async () => {
    batches = [
      { id: "old", createdAt: "2027-01-01T10:00:00Z", createdBy: "admin@uni.test", fileName: "december.xlsx", exams: 10, examRooms: 25,
        studentsUnplaced: 0, remaining: 25, undoneAt: null },
      { id: "gone", createdAt: "2026-12-01T10:00:00Z", createdBy: "admin@uni.test", fileName: "draft.xlsx", exams: 3, examRooms: 5,
        studentsUnplaced: 0, remaining: 0, undoneAt: "2026-12-02T10:00:00Z" },
    ];
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    expect(screen.getByText("december.xlsx")).toBeInTheDocument();
    expect(screen.getByText(/^Undone /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo december.xlsx" }));
    expect(await screen.findByText(/Deletes the 25 exam rooms saved from “december.xlsx”/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo allocation" }));
    await waitFor(() => expect(undoCalls).toHaveBeenCalledWith("old"));
  });

  it("shows the rooms by time and can show only the problems", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    expect(await screen.findByText("Calculus I")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "By room" }));
    const grid = screen.getByRole("region", { name: "Rooms by time" });
    expect(within(grid).getByRole("columnheader", { name: "09:00–11:00" })).toBeInTheDocument();
    expect(within(grid).getByRole("rowheader", { name: /Spare 30/ })).toBeInTheDocument(); // free rooms are listed too
    expect(within(grid).queryByRole("rowheader", { name: /Closed/ })).not.toBeInTheDocument(); // out of service: not offered
    expect(within(grid).getAllByText("MATH101")).toHaveLength(3); // one per room
    expect(within(grid).getByText("Lab 150")).toBeInTheDocument(); // a room the rooms list does not have still shows

    fireEvent.click(screen.getByRole("switch", { name: "Show only problems" }));
    expect(within(grid).queryByRole("rowheader", { name: /Spare 30/ })).not.toBeInTheDocument();
    expect(within(grid).getByRole("rowheader", { name: /Hall 100/ })).toBeInTheDocument(); // MATH101 has students without a seat

    fireEvent.click(screen.getByRole("tab", { name: "By exam" }));
    expect(screen.getByText("Calculus I")).toBeInTheDocument();
    expect(screen.getByText("PHYS1")).toBeInTheDocument(); // Mixed halls = a problem too
  });

  it("lets the user move an exam and choose its rooms, then plans again", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    const file = chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Change MATH101 (row 2)" }));

    // Move to noon.
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "12:00–13:00" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      groupId: "g1", file, dateOrder: "AUTO", adjustments: { times: { "2": "12:00-13:00" }, rooms: {}, dates: {}, anchors: {} },
    }));
    expect(await screen.findByText(/You changed 1 exam on this page/)).toBeInTheDocument();

    // Choose its rooms: Spare 30 + Hall 100 (Room 50 and Room 60 unticked).
    fireEvent.click(await screen.findByRole("button", { name: "Change MATH101 (row 2)" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("switch"));
    expect(within(dialog).getByText("3 rooms · 210 of 300 seats")).toBeInTheDocument(); // starts from the proposed rooms
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Room Room 60" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Room Room 50" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Room Spare 30" }));
    expect(within(dialog).getByText("2 rooms · 130 of 300 seats")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      groupId: "g1", file, dateOrder: "AUTO", adjustments: { times: { "2": "09:00-11:00" }, rooms: { "2": ["r1", "r9"] }, dates: {}, anchors: {} },
    }));

    // Save sends the changes too; Undo my changes plans without them.
    fireEvent.click(await screen.findByRole("button", { name: "Undo my changes" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      groupId: "g1", file, dateOrder: "AUTO", adjustments: { times: {}, rooms: {} },
    }));
  });

  it("drags an exam: only valid places accept it, and Ctrl+Z undoes the move", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    const file = chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    fireEvent.click(await screen.findByRole("tab", { name: "By room" }));
    const grid = screen.getByRole("region", { name: "Rooms by time" });
    expect(within(grid).getByRole("columnheader", { name: "12:00–13:00" })).toBeInTheDocument(); // every time slot
    expect(within(grid).getByText("Booked: OLD1")).toBeInTheDocument();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    const calls = mutateAsync.mock.calls.length;

    // Same time, a room too small to swap in: refused, with the reason.
    fireEvent.dragStart(within(grid).getByLabelText("MATH101 in Hall 100 at 09:00–11:00"), { dataTransfer });
    const small = within(grid).getByLabelText("Free: Spare 30 at 09:00–11:00");
    fireEvent.dragOver(small, { dataTransfer });
    expect(screen.getByRole("status", { name: "Drop check" })).toHaveTextContent("With Spare 30 the exam would have 140 seats for 300 students");
    fireEvent.drop(small, { dataTransfer });
    expect(mutateAsync.mock.calls.length).toBe(calls); // nothing happened

    // Another time, on a big free room: the whole exam moves there.
    fireEvent.dragStart(within(grid).getByLabelText("MATH101 in Hall 100 at 09:00–11:00"), { dataTransfer });
    const big = within(grid).getByLabelText("Free: Big 400 at 12:00–13:00");
    fireEvent.dragOver(big, { dataTransfer });
    expect(screen.getByRole("status", { name: "Drop check" })).toHaveTextContent("✓ Move MATH101 (300 students) to 12:00–13:00, starting in Big 400");
    fireEvent.drop(big, { dataTransfer });
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      groupId: "g1", file, dateOrder: "AUTO",
      adjustments: { times: { "2": "12:00-13:00" }, rooms: {}, dates: {}, anchors: { "2": "r8" } },
    }));
    expect(await screen.findByText(/You changed 1 exam on this page/)).toBeInTheDocument();
    // The page stays where it was: still the room view.
    expect(screen.getByRole("tab", { name: "By room" })).toHaveAttribute("aria-selected", "true");

    // Ctrl+Z: back to before the move.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      groupId: "g1", file, dateOrder: "AUTO", adjustments: { times: {}, rooms: {} },
    }));
    await waitFor(() => expect(screen.queryByText(/You changed 1 exam/)).not.toBeInTheDocument()); // no changes left
  });

  it("refuses a move that would leave more students without a seat", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    fireEvent.click(await screen.findByRole("tab", { name: "By room" }));
    const grid = screen.getByRole("region", { name: "Rooms by time" });
    answer = async () => ({ ...preview, studentsUnplaced: 150 }); // the server's new plan would be worse
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(within(grid).getByLabelText("MATH101 in Hall 100 at 09:00–11:00"), { dataTransfer });
    const big = within(grid).getByLabelText("Free: Big 400 at 12:00–13:00");
    fireEvent.dragOver(big, { dataTransfer });
    fireEvent.drop(big, { dataTransfer });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not moved: the plan would get worse.", expect.anything()));
    expect(screen.queryByText(/You changed 1 exam/)).not.toBeInTheDocument(); // the plan stays as it was
  });

  it("lists every problem row when the file is wrong", async () => {
    const problem = new ApiError({
      message: "2 rows have problems.",
      status: 400,
      validationErrors: [
        { field: "Row 2", message: "Number of students is required to choose rooms." },
        { field: "Row 5", message: "Subject name or subject code is required." },
      ],
    });
    answer = async () => { throw problem; };
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    expect(await screen.findByText("2 problems in the file")).toBeInTheDocument();
    expect(screen.getByText("Number of students is required to choose rooms.")).toBeInTheDocument();
    expect(screen.queryByText("Rooms used")).not.toBeInTheDocument();
  });

  it("refuses files that are not Excel or CSV", () => {
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    chooseFile("exams.pdf");
    expect(screen.getByRole("button", { name: /Choose rooms/ })).toBeDisabled();
  });
});
