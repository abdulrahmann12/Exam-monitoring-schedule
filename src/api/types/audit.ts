import type { ISOInstant, UUID } from "./api";

export type AuditCategory = "AUTH" | "SECURITY" | "USERS" | "PEOPLE" | "ROOMS" | "TIME_SLOTS" | "SCHEDULES" | "SETTINGS" | "OTHER";
export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditEvent {
  id: UUID;
  occurredAt: ISOInstant;
  actorEmail: string | null;
  action: string;
  category: AuditCategory;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  outcome: AuditOutcome;
  ipAddress: string | null;
}

/** All filters are optional. */
export interface AuditQuery {
  page?: number;
  size?: number;
  category?: AuditCategory;
  outcome?: AuditOutcome;
  actor?: string;
  q?: string;
  from?: ISOInstant;
  to?: ISOInstant;
}
