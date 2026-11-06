export type BulkDuplicateStrategy = "AUTO_RENAME" | "SKIP_DUPLICATES";

export interface BulkUploadError {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  successCount: number;
  failedCount: number;
  errors: BulkUploadError[];
}

export interface BulkTemplateDownload {
  blob: Blob;
  fileName: string;
}

// ── Schedule-Group Bulk Schedule Upload ──────────────────────────────────────

/** A single row-level error returned by the backend on a 400 response. */
export interface ScheduleBulkUploadRowError {
  /** 1-based spreadsheet row number. */
  row: number;
  /** Human-readable error description for that row. */
  message: string;
}

/** Shape of the backend's 400 JSON body when the bulk-schedule upload fails validation. */
export interface ScheduleBulkUploadErrorPayload {
  errors: ScheduleBulkUploadRowError[];
}

/** Shape of the successful 200 response after a bulk-schedule upload. */
/** Result of a timetable import (the backend's ScheduleBulkUploadResultDTO). */
export interface ScheduleBulkUploadResult {
  roomAssignmentsCreated: number;
  chiefSlotsTotal: number;
  chiefSlotsFilled: number;
  invigilatorSlotsTotal: number;
  invigilatorSlotsFilled: number;
  /** Staffing shortfalls (the exam rooms were still created). */
  warnings: string[];
  /** Time slots created because the file used times no existing slot had. */
  timeSlotsCreated: string[];
  /** Which column was read as what, e.g. "Exam Start Time → start time". */
  columnsRecognised: string[];
}

/** For dates like 03/04/2027 only; "AUTO" decides from the file. */
export type ImportDateOrder = "AUTO" | "DAY_FIRST" | "MONTH_FIRST";