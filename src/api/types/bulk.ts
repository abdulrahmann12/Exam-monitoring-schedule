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
export interface ScheduleBulkUploadResult {
  /** Number of schedule rows auto-assigned successfully. */
  assignedCount: number;
}