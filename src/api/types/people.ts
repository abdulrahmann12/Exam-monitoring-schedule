import type { ISOInstant, SortDirection, UUID } from "./api";

export type WeekDay = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type PersonRole = "CHIEF_INVIGILATOR" | "INVIGILATOR";

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
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}