import { validateSlotAssignments } from "./constraintEngine";
import { Assignment, Day, Room, Staff } from "./types";

interface GenerateInput {
  roomIds: string[];
  rooms: Room[];
  staff: Staff[];
  day: Day;
  slotId: string;
  existing?: Assignment[];
  overlappingAssignments?: Assignment[];
  defaultSubject?: { subjectName?: string; subjectCode?: string };
  regenerateUnlocked?: boolean;
}

interface GenerateResult {
  assignments: Assignment[];
  staffUpdates: Record<string, number>;
  conflicts: string[];
}

const cloneAssignment = (assignment: Assignment): Assignment => ({
  ...assignment,
  invigilatorIds: [...assignment.invigilatorIds],
});

export function generateSchedule({ roomIds, rooms, staff, day, slotId, existing = [], overlappingAssignments = [], defaultSubject, regenerateUnlocked = false }: GenerateInput): GenerateResult {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const selectedRoomIds = new Set(roomIds);
  const existingByRoom = new Map(existing.map((assignment) => [assignment.roomId, assignment]));
  const preservedAssignments = existing.filter((assignment) => assignment.locked || (regenerateUnlocked && !selectedRoomIds.has(assignment.roomId)));
  const preservedByRoom = new Map(preservedAssignments.map((assignment) => [assignment.roomId, assignment]));
  const chiefRoomCount = new Map<string, number>();
  const usedInvigilators = new Set<string>();
  const delta = new Map<string, number>();
  const conflicts: string[] = [];

  const seedUsage = (assignment: Assignment) => {
    if (assignment.chiefInvigilatorId) chiefRoomCount.set(assignment.chiefInvigilatorId, (chiefRoomCount.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    assignment.invigilatorIds.forEach((id) => id && usedInvigilators.add(id));
  };
  overlappingAssignments.forEach(seedUsage);
  preservedAssignments.forEach(seedUsage);

  const byFairLoad = (a: Staff, b: Staff) => (a.totalAssignments + (delta.get(a.id) ?? 0)) - (b.totalAssignments + (delta.get(b.id) ?? 0)) || a.name.localeCompare(b.name);
  const availableChiefs = () => staff
    .filter((person) => person.role === "CHIEF_INVIGILATOR" && person.workingDays.includes(day))
    .filter((person) => (chiefRoomCount.get(person.id) ?? 0) < 2)
    .sort(byFairLoad);
  const availableInvigilators = () => staff
    .filter((person) => person.role === "INVIGILATOR" && person.workingDays.includes(day) && !usedInvigilators.has(person.id))
    .sort(byFairLoad);

  const assignments: Assignment[] = [];

  for (const roomId of roomIds) {
    const room = roomMap.get(roomId);
    if (!room) continue;
    const preserved = preservedByRoom.get(roomId);
    if (preserved?.locked) {
      assignments.push(cloneAssignment(preserved));
      continue;
    }

    const previous = existingByRoom.get(roomId);
    const invigilatorCount = Math.max(previous?.invigilatorIds.length ?? room.minInvigilators, room.minInvigilators);
    const next: Assignment = {
      roomId,
      slotId,
      chiefInvigilatorId: regenerateUnlocked ? null : previous?.chiefInvigilatorId ?? null,
      invigilatorIds: regenerateUnlocked
        ? Array.from({ length: invigilatorCount }, () => null)
        : previous
          ? [...previous.invigilatorIds]
          : Array.from({ length: room.minInvigilators }, () => null),
      locked: false,
      subjectName: previous?.subjectName ?? defaultSubject?.subjectName,
      subjectCode: previous?.subjectCode ?? defaultSubject?.subjectCode,
    };

    if (next.invigilatorIds.length < room.minInvigilators) {
      next.invigilatorIds.push(...Array.from({ length: room.minInvigilators - next.invigilatorIds.length }, () => null));
    }

    const preValidation = validateSlotAssignments({
      assignments: [...assignments, next],
      rooms,
      staff,
      day,
      overlappingAssignments,
    });
    const chiefInvalid = !next.chiefInvigilatorId || preValidation.issues.some((issue) => issue.staffId === next.chiefInvigilatorId);
    if (chiefInvalid) {
      const chief = availableChiefs()[0] ?? null;
      next.chiefInvigilatorId = chief?.id ?? null;
      if (chief) {
        chiefRoomCount.set(chief.id, (chiefRoomCount.get(chief.id) ?? 0) + 1);
        delta.set(chief.id, (delta.get(chief.id) ?? 0) + 1);
      } else {
        conflicts.push(`No available Chief Invigilator for ${room.name}`);
      }
    } else if (next.chiefInvigilatorId) {
      chiefRoomCount.set(next.chiefInvigilatorId, (chiefRoomCount.get(next.chiefInvigilatorId) ?? 0) + 1);
    }

    next.invigilatorIds = next.invigilatorIds.map((id, index) => {
      const invalid = !id || usedInvigilators.has(id) || !staff.find((person) => person.id === id && person.role === "INVIGILATOR" && person.workingDays.includes(day));
      if (!invalid) {
        usedInvigilators.add(id);
        return id;
      }
      const invigilator = availableInvigilators()[0] ?? null;
      if (invigilator) {
        usedInvigilators.add(invigilator.id);
        delta.set(invigilator.id, (delta.get(invigilator.id) ?? 0) + 1);
        return invigilator.id;
      }
      if (index < room.minInvigilators) conflicts.push(`Missing Invigilator #${index + 1} for ${room.name}`);
      return null;
    });

    assignments.push(next);
  }

  const sharedChiefs = new Set<string>();
  for (const [id, count] of chiefRoomCount.entries()) if (count >= 2) sharedChiefs.add(id);
  const finalAssignments = assignments.map((assignment) => ({
    ...assignment,
    sharedChief: !!(assignment.chiefInvigilatorId && sharedChiefs.has(assignment.chiefInvigilatorId)),
  }));

  const validation = validateSlotAssignments({ assignments: finalAssignments, rooms, staff, day, overlappingAssignments });
  validation.issues.forEach((issue) => conflicts.push(issue.message));

  const staffUpdates: Record<string, number> = {};
  delta.forEach((value, key) => (staffUpdates[key] = value));
  return { assignments: finalAssignments, staffUpdates, conflicts: [...new Set(conflicts)] };
}
