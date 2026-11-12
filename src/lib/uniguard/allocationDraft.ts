import type { ImportDateOrder, RoomAllocationAdjustments, RoomAllocationPreview, RoomAllocationSaved, RoomAllocationStaffed } from "@/api";

/**
 * The Room Allocation page's work in progress, kept in this browser so a page refresh does not lose the
 * uploaded file, the proposal or the results. One per exam period. Best effort: when storage is full or
 * blocked the page simply starts empty.
 */
export interface AllocationDraft {
  fileName: string;
  fileType: string;
  fileBase64: string;
  dateOrder: ImportDateOrder;
  preview: RoomAllocationPreview;
  saved: RoomAllocationSaved | null;
  staffed: RoomAllocationStaffed | null;
  /** Changes made on the page (older drafts have none). */
  adjustments?: RoomAllocationAdjustments;
}

/** Larger files are not kept (browser storage is small). */
export const MAX_DRAFT_FILE_BYTES = 2 * 1024 * 1024;

const key = (groupId: string) => `uniguard.roomAllocation.v1.${groupId}`;

export function loadDraft(groupId: string): AllocationDraft | null {
  try {
    const raw = window.localStorage.getItem(key(groupId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as AllocationDraft;
    return draft && typeof draft.fileBase64 === "string" && draft.preview ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(groupId: string, draft: AllocationDraft) {
  try {
    window.localStorage.setItem(key(groupId), JSON.stringify(draft));
  } catch {
    // storage full or blocked: nothing to do
  }
}

export function clearDraft(groupId: string) {
  try {
    window.localStorage.removeItem(key(groupId));
  } catch {
    // ignore
  }
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1)); // "data:...;base64,XXXX" → "XXXX"
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function base64ToFile(base64: string, name: string, type: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name, { type });
}

/** Exams whose rooms or time in the saved plan differ from the preview the user looked at. */
export function planChanges(preview: RoomAllocationPreview, saved: RoomAllocationPreview): string[] {
  const describe = (plan: RoomAllocationPreview) => {
    const byRow = new Map<number, { label: string; time: string; rooms: string; unplaced: number }>();
    for (const sitting of plan.sittings) {
      for (const exam of sitting.exams) {
        byRow.set(exam.row, {
          label: exam.subjectCode ?? exam.subjectName ?? `Row ${exam.row}`,
          time: `${sitting.date} ${sitting.time}`,
          rooms: exam.rooms.map((room) => room.name).sort().join(", "),
          unplaced: exam.unplaced,
        });
      }
    }
    return byRow;
  };
  const before = describe(preview);
  const after = describe(saved);
  const changes: string[] = [];
  for (const [row, now] of after) {
    const was = before.get(row);
    if (!was) continue;
    if (was.time !== now.time) {
      changes.push(`Row ${row} ${now.label}: time ${was.time} → ${now.time}`);
    } else if (was.rooms !== now.rooms) {
      changes.push(`Row ${row} ${now.label}: rooms ${was.rooms || "none"} → ${now.rooms || "none"}`);
    } else if (was.unplaced !== now.unplaced) {
      changes.push(`Row ${row} ${now.label}: students without a seat ${was.unplaced} → ${now.unplaced}`);
    }
  }
  return changes;
}
