import { Assignment, AssignmentState, Day, Role, Room, Slot, Staff } from "./types";

export interface ValidationIssue {
  type: "availability" | "concurrency" | "capacity" | "role";
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
}): AssignmentValidation {
  const { assignments, rooms, staff, day, overlappingAssignments = [] } = opts;
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
    if (filledInvigilators < room.minInvigilators) {
      issues.push({ type: "capacity", roomId: assignment.roomId, message: `${room.name} needs ${room.minInvigilators} Invigilator${room.minInvigilators > 1 ? "s" : ""}.` });
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
    if (count > 2) issues.push({ type: "concurrency", staffId, message: `${person.name} exceeds the 2-room Chief Invigilator limit at an overlapping time.` });
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
): AssignmentValidation {
  const slotValidation = validateSlotAssignments({ assignments: allAssignments, rooms, staff, day, overlappingAssignments });
  const roomIssues = slotValidation.issues.filter((issue) => issue.roomId === assignment.roomId || [assignment.chiefInvigilatorId, ...assignment.invigilatorIds].some((id) => id && id === issue.staffId));
  const hasConflict = roomIssues.some((issue) => issue.type !== "capacity");
  return { state: hasConflict ? "CONFLICT" : roomIssues.length > 0 ? "INCOMPLETE" : "VALID", issues: roomIssues, tracker: slotValidation.tracker };
}

export function getPickerTiers(opts: { role: Role; day: Day; staff: Staff[]; assignments: Assignment[]; currentId?: string | null }) {
  const { role, day, staff, assignments, currentId } = opts;
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
    if (role === "CHIEF_INVIGILATOR") {
      const count = chiefCounts.get(person.id) ?? 0;
      if (count === 0) free.push(person);
      else if (count === 1) partiallyBusy.push(person);
      else unavailable.push({ staff: person, reason: "At 2-room overlapping limit" });
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
