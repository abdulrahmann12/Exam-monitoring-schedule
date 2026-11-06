import type { ISOInstant, UUID } from "./api";

export type EmailStatus = "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";
export type EmailKind = "SCHEDULE" | "INVITE" | "PASSWORD_RESET";

/** One email in the delivery log (never its content). */
export interface EmailLogEntry {
  id: UUID;
  batchId: UUID | null;
  kind: EmailKind;
  recipient: string;
  recipientName: string | null;
  subject: string;
  status: EmailStatus;
  attempts: number;
  nextAttemptAt: ISOInstant | null;
  lastError: string | null;
  createdAt: ISOInstant;
  sentAt: ISOInstant | null;
  createdBy: string | null;
}

export interface EmailCounts {
  counts: Record<string, number>;
}
