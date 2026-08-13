import type { ISODate, ISOInstant, ISOTime, SortDirection, UUID } from "./api";

export type AssignmentSource = "GENERATED" | "MANUAL" | "MIXED";

export interface AssignmentsQuery {
  page?: number;
  size?: number;
  sortBy?:
    | "id"
    | "examDate"
    | "subjectName"
    | "subjectCode"
    | "locked"
    | "source"
    | "generationVersion"
    | "timeSlot.startTime"
    | "room.name";
  direction?: SortDirection;
  scheduleGroupId?: UUID;
  slotId?: UUID;
  roomId?: UUID;
  locked?: boolean;
  fromDate?: ISODate;
  toDate?: ISODate;
}

export interface AssignmentRequest {
  scheduleGroupId?: UUID;
  examDate: ISODate;
  roomId: UUID;
  timeSlotId: UUID;
  subjectName?: string | null;
  subjectCode?: string | null;
  chiefInvigilatorId?: UUID | null;
  locked: boolean;
  source?: AssignmentSource;
  invigilatorIds: Array<UUID | null>;
}

export interface BulkAssignmentRequest {
  scheduleGroupId?: UUID;
  examDate: ISODate;
  roomId: UUID;
  slotId: UUID;
  subjectName?: string | null;
  subjectCode?: string | null;
  chiefInvigilatorId?: UUID | null;
  isLocked: boolean;
  invigilatorIds: Array<UUID | null>;
}

export interface AssignmentInvigilator {
  id: UUID;
  invigilatorId: UUID | null;
  invigilatorName: string | null;
  positionIndex: number;
  required: boolean;
  createdAt: ISOInstant;
}

export interface Assignment {
  id: UUID;
  scheduleGroupId?: UUID;
  examDate: ISODate;
  roomId: UUID;
  roomName: string;
  timeSlotId: UUID;
  slotLabel: string;
  startTime: ISOTime;
  endTime: ISOTime;
  subjectName: string | null;
  subjectCode: string | null;
  chiefInvigilatorId: UUID | null;
  chiefInvigilatorName: string | null;
  locked: boolean;
  generationVersion: number;
  source: AssignmentSource;
  invigilators: AssignmentInvigilator[];
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}