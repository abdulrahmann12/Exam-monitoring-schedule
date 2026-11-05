import { Assignment, AssignmentState, Day, Role, Room, Slot, Staff, requiredInvigilators } from "./types";

/**
 * Client-side constraint hints for instant feedback while editing a draft.
 * The server re-checks everything on save (including other exam periods, leave and
 * daily limits), so these checks only need to be a fast, faithful subset.
 */

/** Reason a person may not sit in this room at all (hall gender / own subject), or null. */
export function roomRestriction(person: Staff, room?: Room, subjectCode?: string | null): { type: "gender" | "subject"; message: string } | null {
  if (room?.hallGender && room.hallGender !== "MIXED" && person.gender !== room.hallGender) {
    return { type: "gender", message: `${person.name} cannot supervise ${room.name} (${room.hallGender.toLowerCase()}-only hall).` };
  }
  const code = subjectCode?.trim().toUpperCase();
  if (code && person.subjectCodes?.includes(code)) {
    return { type: "subject", message: `${person.name} teaches ${code} and cannot invigilate it.` };
  }
  return null;
}

const parallelLimit = (person: Staff) => person.maxParallelRooms ?? (person.role === "CHIEF_INVIGILATOR" ? 2 : 1);

export interface ValidationIssue {
  type: "availability" | "concurrency" | "capacity" | "role" | "gender" | "subject";
  message: string;
  staffId?: string;
  roomId?: string;
}

export interface AssignmentValidation {
  state: AssignmentState;
  issues: ValidationIssue[];
  tracker: Map<string, number>;
}

export function slotsOverlap(
  left?: { startTime: string; endTime: string } | null,
  right?: { startTime: string; endTime: string } | null,
): boolean {
  if (!left || !right) {
    return false;
  }
  return left.startTime < right.endTime && left.endTime > right.startTime;
}

export function overlappingAssignmentsForSlot(assignments: Assignment[], slots: Slot[], slotId: string): Assignment[] {
  const target = slots.find((slot) => slot.id === slotId);
  if (!target) {
    return assignments.filter((assignment) => assignment.slotId === slotId);
  }
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  return assignments.filter((assignment) => {
    const slot = slotById.get(assignment.slotId);
    return slot ? slotsOverlap(target, slot) : assignment.slotId === slotId;
  });
}

export function buildAssignmentTracker(assignments: Assignment[]) {
  const tracker = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.chiefInvigilatorId) tracker.set(assignment.chiefInvigilatorId, (tracker.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    assignment.invigilatorIds.forEach((id) => id && tracker.set(id, (tracker.get(id) ?? 0) + 1));
  }
  return tracker;
}

export function validateSlotAssignments(opts: {
  assignments: Assignment[];
  rooms: Room[];
  staff: Staff[];
  day: Day;
  overlappingAssignments?: Assignment[];
  studentsPerInvigilator?: number;
}): AssignmentValidation {
  const { assignments, rooms, staff, day, overlappingAssignments = [], studentsPerInvigilator = 0 } = opts;
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const staffMap = new Map(staff.map((person) => [person.id, person]));
  const concurrencyAssignments = [...overlappingAssignments, ...assignments];
  const chiefCounts = new Map<string, number>();
  const invigilatorCounts = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  for (const assignment of assignments) {
    const room = roomMap.get(assignment.roomId);
    if (!room) continue;
    if (!assignment.chiefInvigilatorId) issues.push({ type: "capacity", roomId: assignment.roomId, message: `${room.name} is missing a Chief Invigilator.` });
    const filledInvigilators = assignment.invigilatorIds.filter(Boolean).length;
    const required = requiredInvigilators(room, assignment.studentCount, studentsPerInvigilator);
    if (filledInvigilators < required) {
      issues.push({ type: "capacity", roomId: assignment.roomId, message: `${room.name} needs ${required} Invigilator${required > 1 ? "s" : ""}.` });
    }
    for (const staffId of [assignment.chiefInvigilatorId, ...assignment.invigilatorIds]) {
      const person = staffId ? staffMap.get(staffId) : undefined;
      const restriction = person ? roomRestriction(person, room, assignment.subjectCode) : null;
      if (person && restriction) issues.push({ type: restriction.type, staffId: person.id, roomId: assignment.roomId, message: restriction.message });
    }
  }

  for (const assignment of concurrencyAssignments) {
    if (assignment.chiefInvigilatorId) chiefCounts.set(assignment.chiefInvigilatorId, (chiefCounts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    assignment.invigilatorIds.forEach((id) => id && invigilatorCounts.set(id, (invigilatorCounts.get(id) ?? 0) + 1));
  }

  for (const [staffId, count] of chiefCounts) {
    const person = staffMap.get(staffId);
    if (!person) continue;
    if (person.role !== "CHIEF_INVIGILATOR") issues.push({ type: "role", staffId, message: `${person.name} is not a Chief Invigilator.` });
    if (!person.workingDays.includes(day)) issues.push({ type: "availability", staffId, message: `${person.name} is unavailable on ${day}.` });
    const limit = parallelLimit(person);
    if (count > limit) issues.push({ type: "concurrency", staffId, message: `${person.name} exceeds the ${limit}-room Chief Invigilator limit at an overlapping time.` });
  }

  for (const [staffId, count] of invigilatorCounts) {
    const person = staffMap.get(staffId);
    if (!person) continue;
    if (person.role !== "INVIGILATOR") issues.push({ type: "role", staffId, message: `${person.name} is not an Invigilator.` });
    if (!person.workingDays.includes(day)) issues.push({ type: "availability", staffId, message: `${person.name} is unavailable on ${day}.` });
    if (count > 1) issues.push({ type: "concurrency", staffId, message: `${person.name} is already assigned at an overlapping time.` });
  }

  const hasConflict = issues.some((issue) => issue.type !== "capacity");
  return {
    state: hasConflict ? "CONFLICT" : issues.length > 0 ? "INCOMPLETE" : "VALID",
    issues,
    tracker: buildAssignmentTracker(concurrencyAssignments),
  };
}

export function validateAssignment(
  assignment: Assignment,
  allAssignments: Assignment[],
  rooms: Room[],
  staff: Staff[],
  day: Day,
  overlappingAssignments: Assignment[] = [],
  studentsPerInvigilator = 0,
): AssignmentValidation {
  const slotValidation = validateSlotAssignments({ assignments: allAssignments, rooms, staff, day, overlappingAssignments, studentsPerInvigilator });
  const roomIssues = slotValidation.issues.filter((issue) => issue.roomId === assignment.roomId
    || (!issue.roomId && [assignment.chiefInvigilatorId, ...assignment.invigilatorIds].some((id) => id && id === issue.staffId)));
  const hasConflict = roomIssues.some((issue) => issue.type !== "capacity");
  return { state: hasConflict ? "CONFLICT" : roomIssues.length > 0 ? "INCOMPLETE" : "VALID", issues: roomIssues, tracker: slotValidation.tracker };
}

export function getPickerTiers(opts: { role: Role; day: Day; staff: Staff[]; assignments: Assignment[]; currentId?: string | null; room?: Room; subjectCode?: string | null }) {
  const { role, day, staff, assignments, currentId, room, subjectCode } = opts;
  const chiefCounts = new Map<string, number>();
  const busyInvigilators = new Set<string>();
  assignments.forEach((assignment) => {
    if (assignment.chiefInvigilatorId && assignment.chiefInvigilatorId !== currentId) chiefCounts.set(assignment.chiefInvigilatorId, (chiefCounts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    assignment.invigilatorIds.forEach((id) => id && id !== currentId && busyInvigilators.add(id));
  });

  const free: Staff[] = [];
  const partiallyBusy: Staff[] = [];
  const unavailable: { staff: Staff; reason: string }[] = [];

  for (const person of staff.filter((candidate) => candidate.role === role)) {
    if (person.id === currentId) continue;
    if (!person.workingDays.includes(day)) {
      unavailable.push({ staff: person, reason: "Off day" });
      continue;
    }
    const restriction = roomRestriction(person, room, subjectCode);
    if (restriction) {
      unavailable.push({ staff: person, reason: restriction.type === "gender" ? "Hall gender" : "Teaches this subject" });
      continue;
    }
    if (role === "CHIEF_INVIGILATOR") {
      const count = chiefCounts.get(person.id) ?? 0;
      const limit = parallelLimit(person);
      if (count === 0) free.push(person);
      else if (count < limit) partiallyBusy.push(person);
      else unavailable.push({ staff: person, reason: `At ${limit}-room overlapping limit` });
    } else if (busyInvigilators.has(person.id)) {
      unavailable.push({ staff: person, reason: "Busy at an overlapping time" });
    } else {
      free.push(person);
    }
  }

  const byLoad = (a: Staff, b: Staff) => a.totalAssignments - b.totalAssignments || a.name.localeCompare(b.name);
  free.sort(byLoad);
  partiallyBusy.sort(byLoad);
  unavailable.sort((a, b) => a.staff.name.localeCompare(b.staff.name));
  return { free, partiallyBusy, unavailable };
}
