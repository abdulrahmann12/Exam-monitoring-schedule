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

export interface ScheduleNotifyResult {
  sent: number;
  skipped: number;
  failed: number;
  skippedNames: string[];
  failedNames: string[];
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
