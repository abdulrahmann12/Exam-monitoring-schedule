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
  /** "Male" / "Female"; null = a mixed exam (any hall). */
  gender: "Male" | "Female" | null;
  /** A Male/Female exam that needed Mixed halls (not enough halls of its gender). */
  mixedHalls: boolean;
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
}

/** POST /api/room-allocation/save */
export interface RoomAllocationSaved {
  roomAssignmentsCreated: number;
  /** The exam rooms created, for "Create schedule". */
  assignmentIds: UUID[];
  examsSaved: number;
  examsIncomplete: number;
  studentsUnplaced: number;
  timeSlotsCreated: string[];
  warnings: string[];
  firstDate: string | null;
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
}
