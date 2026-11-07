import { requiredInvigilators, type Assignment, type Room } from "./types";

/** What one exam room still needs. */
export interface RoomStaffing {
  missingChief: boolean;
  required: number;
  filled: number;
  missingInvigilators: number;
  complete: boolean;
}

export function roomStaffing(assignment: Assignment, room: Pick<Room, "minInvigilators"> | undefined, studentsPerInvigilator = 0): RoomStaffing {
  const required = room ? requiredInvigilators(room, assignment.studentCount, studentsPerInvigilator) : 0;
  const filled = assignment.invigilatorIds.filter(Boolean).length;
  const missingInvigilators = Math.max(required - filled, 0);
  const missingChief = !assignment.chiefInvigilatorId;
  return { missingChief, required, filled, missingInvigilators, complete: !missingChief && missingInvigilators === 0 };
}

/** Rooms each chief covers within one date + slot (a chief may cover several rooms at once). */
export function chiefRoomCounts(assignments: Assignment[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.chiefInvigilatorId) counts.set(assignment.chiefInvigilatorId, (counts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
  }
  return counts;
}

/** Short label for what is missing, or null when the room is complete. */
export function staffingGapLabel(staffing: RoomStaffing): string | null {
  const parts: string[] = [];
  if (staffing.missingChief) parts.push("No chief");
  if (staffing.missingInvigilators > 0) {
    parts.push(staffing.filled === 0
      ? `${staffing.missingInvigilators} invigilator${staffing.missingInvigilators === 1 ? "" : "s"} missing`
      : `${staffing.missingInvigilators} of ${staffing.required} invigilators missing`);
  }
  return parts.length ? parts.join(" · ") : null;
}
