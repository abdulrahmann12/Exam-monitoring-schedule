import type { ISOInstant, SortDirection, UUID } from "./api";

export interface ScheduleGroupsQuery {
  page?: number;
  size?: number;
  sortBy?: "id" | "name" | "active" | "createdAt" | "updatedAt";
  direction?: SortDirection;
  name?: string;
  activeOnly?: boolean;
}

export interface ScheduleGroupRequest {
  name: string;
  description?: string | null;
  active?: boolean;
}

/** Emails are queued and sent in the background (see the Emails page). */
export interface ScheduleNotifyResult {
  queued: number;
  /** Staff without an email address. */
  skipped: number;
  /** Staff whose schedule was already emailed unchanged (not sent again). */
  unchanged: number;
  skippedNames: string[];
  batchId: string;
}

export interface ScheduleGroup {
  id: UUID;
  name: string;
  description: string | null;
  active: boolean;
  timeSlotCount: number;
  assignmentCount: number;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}
