import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api";

import { MemoryRouter } from "react-router-dom";

import RoomAllocation from "./RoomAllocation";

/** Records the calls. A plain function gives the answer: a rejecting vi.fn is reported as a test error even when handled. */
const mutateAsync = vi.fn();
let answer: () => Promise<unknown> = async () => undefined;
const saveCalls = vi.fn();
const staffCalls = vi.fn();

vi.mock("@/hooks/useRoomAllocation", () => ({
  usePreviewRoomAllocationMutation: () => ({
    mutateAsync: (variables: unknown) => { mutateAsync(variables); return answer(); },
    isPending: false,
  }),
  useSaveRoomAllocationMutation: () => ({
    mutateAsync: async (variables: unknown) => {
      saveCalls(variables);
      return { roomAssignmentsCreated: 4, assignmentIds: ["a1", "a2", "a3", "a4"], examsSaved: 2, examsIncomplete: 1,
        studentsUnplaced: 90, timeSlotsCreated: ["Exam 09:00–11:00"], warnings: [], firstDate: "2027-01-10" };
    },
    isPending: false,
  }),
  useStaffRoomAllocationMutation: () => ({
    mutateAsync: async (variables: unknown) => {
      staffCalls(variables);
      return { examRooms: 4, alreadyStaffed: 0, chiefSlotsTotal: 4, chiefSlotsFilled: 4, invigilatorSlotsTotal: 9, invigilatorSlotsFilled: 8,
        warnings: ["1 invigilator seat(s) could not be filled for room 'Room 50' on 2027-01-10 (09:00–11:00)."] };
    },
    isPending: false,
  }),
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
      { row: 2, subjectName: "Calculus I", subjectCode: "MATH101", students: 300, roomType: null, freeOfType: null, timeChosen: false, gender: null, mixedHalls: false, unplaced: 90, rooms: [
        { roomId: "r1", name: "Hall 100", capacity: 100, students: 100 },
        { roomId: "r2", name: "Room 60", capacity: 60, students: 60 },
        { roomId: "r3", name: "Room 50", capacity: 50, students: 50 },
      ] },
      { row: 3, subjectName: null, subjectCode: "PHYS1", students: 150, roomType: "Computer Lab", freeOfType: 1, timeChosen: true, gender: "Female", mixedHalls: true, unplaced: 0, rooms: [
        { roomId: "r4", name: "Lab 150", capacity: 150, students: 150 },
      ] },
    ],
  }],
  warnings: ["Row 2: not enough free rooms on 2027-01-10 09:00–11:00: 90 of 300 students have no seat."],
  timeSlotsToCreate: ["Exam 09:00–11:00"],
  columnsRecognised: [],
};

function chooseFile(name = "exams.csv") {
  const file = new File(["Date,Time Slot,Code,Students"], name, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("Exam list file"), { target: { files: [file] } });
  return file;
}

describe("room allocation page", () => {
  beforeEach(() => { mutateAsync.mockClear(); saveCalls.mockClear(); staffCalls.mockClear(); answer = async () => undefined; });

  it("uploads the exam list and shows the proposed rooms", async () => {
    answer = async () => preview;
    render(<MemoryRouter><RoomAllocation /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Choose rooms/ })).toBeDisabled();

    const file = chooseFile();
    fireEvent.click(screen.getByRole("button", { name: /Choose rooms/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ groupId: "g1", file, dateOrder: "AUTO" }));

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
    await waitFor(() => expect(saveCalls).toHaveBeenCalledWith({ groupId: "g1", file, dateOrder: "AUTO" }));
    expect(await screen.findByText(/4 exam rooms saved, new time slots: Exam 09:00–11:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Scheduler" })).toHaveAttribute("href", "/scheduler?date=2027-01-10");

    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));
    await waitFor(() => expect(staffCalls).toHaveBeenCalledWith({ groupId: "g1", assignmentIds: ["a1", "a2", "a3", "a4"] }));
    expect(await screen.findByText("Chiefs 4/4, invigilators 8/9.")).toBeInTheDocument();
    expect(screen.getByText(/could not be filled for room 'Room 50'/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create schedule" })).not.toBeInTheDocument(); // never twice from here
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
