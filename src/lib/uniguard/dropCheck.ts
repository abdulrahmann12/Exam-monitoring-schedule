import type { AllocatedExam, AllocationSitting, Room, RoomAllocationPreview } from "@/api";

/** "09:00–11:00" or "09:00-11:00" → [start, end] in minutes */
export function minutes(time: string): [number, number] {
  const [start, end] = time.split(/[–-]/).map((part) => {
    const [h, m] = part.trim().split(":").map(Number);
    return h * 60 + m;
  });
  return [start, end];
}

export const overlaps = (a: string, b: string) => {
  const [as, ae] = minutes(a);
  const [bs, be] = minutes(b);
  return as < be && ae > bs;
};

const subjectOf = (exam: AllocatedExam) => exam.subjectCode ?? exam.subjectName ?? `row ${exam.row}`;

/** May this room seat that exam at all (room type and hall gender)? */
export function roomFits(exam: AllocatedExam, room: Room) {
  const typeOk = exam.roomType ? room.roomCategoryName === exam.roomType : !room.roomCategorySpecial;
  const hall = room.hallGender ?? "MIXED";
  const genderOk = !exam.gender || hall === "MIXED" || hall === exam.gender.toUpperCase();
  return typeOk && genderOk;
}

/** The exam being dragged: one of its room blocks (or none, when it has no room yet). */
export interface Dragged {
  exam: AllocatedExam;
  sitting: AllocationSitting;
  /** The room block that was picked up (null = an exam without rooms). */
  fromRoomId: string | null;
}

/** "HH:mm–HH:mm" display time; date "yyyy-mm-dd". */
export interface Target {
  date: string;
  time: string;
  roomId?: string;
}

export interface DropCheck {
  ok: boolean;
  /** Shown while dragging: why it can or cannot go there. */
  reason: string;
  /** Same time, another room: the exam's new rooms (only that one room swapped). */
  swapRooms?: string[];
}

/** All rows of the same subject at the same time move together (e.g. its Male and Female rows). */
export function movingGroup(dragged: Dragged): AllocatedExam[] {
  const subject = subjectOf(dragged.exam);
  return dragged.sitting.exams.filter((exam) => exam.row === dragged.exam.row || subjectOf(exam) === subject);
}

/**
 * Can the dragged exam go to the target? Rules: an exam's rooms always stay at one time (the whole exam moves);
 * the same time with another room only swaps that one room; the room must be the right type and gender hall,
 * not booked or in use; and there must be enough free seats there for every student. The server checks again.
 */
export function checkDrop(preview: RoomAllocationPreview, rooms: Room[], dragged: Dragged, target: Target): DropCheck {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const sameTime = target.date === dragged.sitting.date && target.time === dragged.sitting.time;
  const group = movingGroup(dragged);
  const groupRows = new Set(group.map((exam) => exam.row));

  /** Rooms busy at that date and time: bookings, and this plan's exams at an overlapping time (not the moving ones). */
  const busy = new Map<string, string>();
  for (const entry of preview.booked ?? []) {
    if (entry.date === target.date && overlaps(entry.time, target.time)) busy.set(entry.roomId, entry.label);
  }
  for (const sitting of preview.sittings) {
    if (sitting.date !== target.date || !overlaps(sitting.time, target.time)) continue;
    const sameSitting = sitting.date === dragged.sitting.date && sitting.time === dragged.sitting.time;
    for (const exam of sitting.exams) {
      if (sameSitting && groupRows.has(exam.row)) continue; // these move away
      for (const room of exam.rooms) busy.set(room.roomId, `in use by ${subjectOf(exam)}`);
    }
  }

  const targetRoom = target.roomId ? byId.get(target.roomId) : undefined;
  if (target.roomId) {
    if (!targetRoom || !targetRoom.active) return { ok: false, reason: "✗ This room is not in service." };
    if (busy.has(targetRoom.id)) return { ok: false, reason: `✗ ${targetRoom.name} is ${busy.get(targetRoom.id)} at ${target.time}.` };
    if (!roomFits(dragged.exam, targetRoom)) {
      const exam = dragged.exam;
      const hall = targetRoom.hallGender === "FEMALE" ? "Female" : "Male";
      let reason: string;
      if (exam.roomType && targetRoom.roomCategoryName !== exam.roomType) {
        reason = `✗ ${subjectOf(exam)} needs a “${exam.roomType}” room.`;
      } else if (!exam.roomType && targetRoom.roomCategorySpecial) {
        reason = `✗ ${targetRoom.name} is a “${targetRoom.roomCategoryName}” room: only for exams that ask for it.`;
      } else {
        reason = `✗ ${targetRoom.name} is a ${hall} hall; ${subjectOf(exam)} is ${exam.gender}.`;
      }
      return { ok: false, reason };
    }
  }

  if (sameTime && !targetRoom) {
    return { ok: false, reason: "✗ It is already at this time." };
  }
  if (sameTime && dragged.fromRoomId) {
    // Same time: only the picked-up room is swapped; the rest of the exam stays.
    if (!targetRoom) return { ok: false, reason: "✗ It is already at this time." };
    const newRooms = dragged.exam.rooms.map((room) => room.roomId).filter((id) => id !== dragged.fromRoomId);
    newRooms.push(targetRoom.id);
    const seats = newRooms.reduce((sum, id) => sum + (byId.get(id)?.capacity ?? 0), 0);
    const seatedNow = dragged.exam.students - dragged.exam.unplaced;
    if (seats < Math.min(dragged.exam.students, seatedNow)) { // never fewer seats than now
      return { ok: false, reason: `✗ With ${targetRoom.name} the exam would have ${seats} seats for ${dragged.exam.students} students.` };
    }
    const from = dragged.exam.rooms.find((room) => room.roomId === dragged.fromRoomId)?.name ?? "the room";
    return {
      ok: true,
      reason: `✓ Swap ${from} for ${targetRoom.name} (${Math.min(seats, dragged.exam.students)} of ${dragged.exam.students} students seated).`,
      swapRooms: newRooms,
    };
  }

  // Another time or day: the whole exam (all its rows) moves; is there room for every student?
  const free = rooms.filter((room) => room.active && !busy.has(room.id));
  const left = new Set(free.map((room) => room.id));
  const ordered = [...group].sort((a, b) => (a.row === dragged.exam.row ? -1 : b.row === dragged.exam.row ? 1 : b.students - a.students));
  for (const exam of ordered) {
    let need = exam.students;
    if (exam.row === dragged.exam.row && targetRoom) {
      need -= targetRoom.capacity;
      left.delete(targetRoom.id);
    }
    const usable = free.filter((room) => left.has(room.id) && roomFits(exam, room)).sort((a, b) => b.capacity - a.capacity);
    const seats = usable.reduce((sum, room) => sum + room.capacity, 0);
    const seatedNow = exam.students - exam.unplaced;
    const shortNow = exam.students - seatedNow; // students already without a seat may stay without one
    if (need - shortNow > seats) { // never fewer seats than now
      const kind = exam.roomType ? `“${exam.roomType}” rooms` : exam.gender ? `${exam.gender} or Mixed halls` : "rooms";
      return { ok: false, reason: `✗ At ${target.time} only ${Math.max(seats + (exam.row === dragged.exam.row && targetRoom ? targetRoom.capacity : 0), 0)} seats in free ${kind} for ${exam.students} students (${subjectOf(exam)}).` };
    }
    for (const room of usable) {
      if (need <= 0) break;
      left.delete(room.id);
      need -= room.capacity;
    }
  }
  const students = group.reduce((sum, exam) => sum + exam.students, 0);
  const where = target.date === dragged.sitting.date ? target.time : `${target.date} ${target.time}`;
  return {
    ok: true,
    reason: `✓ Move ${subjectOf(dragged.exam)} (${students} students${group.length > 1 ? `, ${group.length} rows` : ""}) to ${where}${targetRoom ? `, starting in ${targetRoom.name}` : ""}.`,
  };
}

/** Why an exam is yellow, in words (shown when pointing at it). It is about the whole exam, not one room. */
export function problemReasons(exam: AllocatedExam): string[] {
  const reasons: string[] = [];
  if (exam.unplaced > 0) {
    reasons.push(`Problem: ${exam.unplaced} of ${exam.students} students have no seat.`);
  }
  if (exam.mixedHalls) {
    reasons.push(`Problem: a ${exam.gender ?? ""} exam in a Mixed hall (no free ${exam.gender ?? ""} hall at this time). Seats are fine.`.replace(/ {2,}/g, " "));
  }
  return reasons;
}
