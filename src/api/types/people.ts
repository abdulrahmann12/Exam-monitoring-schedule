import type { ISOInstant, SortDirection, UUID } from "./api";

export type WeekDay = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type PersonRole = "CHIEF_INVIGILATOR" | "INVIGILATOR";
export type Gender = "MALE" | "FEMALE";

export interface PeopleQuery {
  page?: number;
  size?: number;
  sortBy?: "id" | "name" | "department" | "role" | "totalAssignments";
  direction?: SortDirection;
  role?: PersonRole;
  department?: string;
  name?: string;
  scheduleGroupId?: UUID;
}

export interface PersonRequest {
  name: string;
  department: string;
  email?: string | null;
  role: PersonRole;
  availableDays: WeekDay[];
  /** Optional; needed only for gender-separated halls. */
  gender?: Gender | null;
  /** Subject codes this person teaches (never assigned to those exams). */
  subjectCodes?: string[];
}

export interface Person {
  id: UUID;
  name: string;
  department: string;
  email?: string | null;
  role: PersonRole;
  availableDays: WeekDay[];
  totalAssignments: number;
  active: boolean;
  maxParallelRooms: number;
  gender?: Gender | null;
  subjectCodes?: string[];
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

/** Date-specific leave (inclusive range). */
export interface Unavailability {
  id: UUID;
  personId: UUID;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: ISOInstant;
}

export interface UnavailabilityRequest {
  startDate: string;
  endDate: string;
  reason?: string | null;
}
