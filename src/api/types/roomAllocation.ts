import type { UUID } from "./api";

/** One room proposed for an exam. */
export interface AllocatedRoom {
  roomId: UUID;
  name: string;
  capacity: number;
  students: number;
}

/** One exam (file row) and the rooms proposed for it. */
export interface AllocatedExam {
  row: number;
  subjectName: string | null;
  subjectCode: string | null;
  students: number;
  /** The room type the exam asked for; null = a normal room. */
  roomType: string | null;
  /** Free rooms of that type at that time (null for normal exams). */
  freeOfType: number | null;
  /** true = the file left the time slot empty and Uni-Guard chose it. */
  timeChosen: boolean;
  /** true = changed by the user on the page (time or rooms). */
  edited: boolean;
  /** "Male" / "Female"; null = a mixed exam (any hall). */
  gender: "Male" | "Female" | null;
  /** A Male/Female exam that needed Mixed halls (not enough halls of its gender). */
  mixedHalls: boolean;
  /** How to fix a problem, worked out from the university's own rooms and times (empty when fine). */
  hints: string[];
  /** Students without a seat (not enough free rooms). */
  unplaced: number;
  rooms: AllocatedRoom[];
}

/** One date and time. */
export interface AllocationSitting {
  date: string;
  day: string;
  time: string;
  /** null when this time slot does not exist yet (it is created on confirm). */
  timeSlotId: UUID | null;
  /** Free normal rooms (special types are counted per exam in freeOfType). */
  freeRooms: number;
  exams: AllocatedExam[];
}

/** POST /api/room-allocation/preview: proposed rooms, nothing saved. */
export interface RoomAllocationPreview {
  exams: number;
  examsFullySeated: number;
  students: number;
  studentsUnplaced: number;
  roomsUsed: number;
  seats: number;
  emptySeats: number;
  sittings: AllocationSitting[];
  warnings: string[];
  timeSlotsToCreate: string[];
  columnsRecognised: string[];
  /** Rooms already booked outside this plan on the plan's days (room view: no drop there). */
  booked: { date: string; time: string; roomId: UUID; label: string }[];
}

/** POST /api/room-allocation/save */
export interface RoomAllocationSaved {
  /** This save, for Undo. */
  batchId: UUID;
  roomAssignmentsCreated: number;
  /** The exam rooms created, for "Create schedule". */
  assignmentIds: UUID[];
  examsSaved: number;
  examsIncomplete: number;
  studentsUnplaced: number;
  timeSlotsCreated: string[];
  warnings: string[];
  firstDate: string | null;
  /** What was saved: compared with the preview the user looked at. */
  plan: RoomAllocationPreview;
}

/** One saved allocation (GET /api/room-allocation/batches). */
export interface RoomAllocationBatch {
  id: UUID;
  createdAt: string;
  createdBy: string | null;
  fileName: string | null;
  exams: number;
  examRooms: number;
  studentsUnplaced: number;
  /** Exam rooms of this save that still exist. */
  remaining: number;
  undoneAt: string | null;
}

export interface RoomAllocationUndone {
  batchId: UUID;
  fileName: string | null;
  examRoomsDeleted: number;
}

/** POST /api/room-allocation/staff ("Create schedule") */
export interface RoomAllocationStaffed {
  examRooms: number;
  /** Skipped because someone was already assigned (never staffed twice). */
  alreadyStaffed: number;
  chiefSlotsTotal: number;
  chiefSlotsFilled: number;
  invigilatorSlotsTotal: number;
  invigilatorSlotsFilled: number;
  warnings: string[];
  /** Per time with empty seats: why staff are missing and what to do. */
  hints: string[];
}

/** Changes made on the page before saving, by file row: another time ("HH:mm-HH:mm") and/or exact room ids. */
export interface RoomAllocationAdjustments {
  times: Record<string, string>;
  rooms: Record<string, string[]>;
  /** Another day, "yyyy-mm-dd". */
  dates?: Record<string, string>;
  /** Dropped on this room: it goes first, Uni-Guard adds rooms when it is too small. */
  anchors?: Record<string, string>;
}
