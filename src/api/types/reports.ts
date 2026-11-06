import type { UUID } from "./api";

/** Sessions and hours of one person in an exam period. A sitting counts once even with two rooms at once. */
export interface PersonWorkload {
  personId: UUID;
  name: string;
  email: string | null;
  department: string | null;
  role: "CHIEF_INVIGILATOR" | "INVIGILATOR" | null;
  active: boolean;
  sessions: number;
  hours: number;
  roomsAsChief: number;
  roomsAsInvigilator: number;
  days: number;
  firstDuty: string | null;
  lastDuty: string | null;
}

export interface WorkloadReport {
  scheduleGroupId: UUID;
  scheduleGroupName: string;
  staff: number;
  sessions: number;
  hours: number;
  people: PersonWorkload[];
}

/** score: 100 = everyone of this role has the same hours; null when nobody has duties yet. */
export interface FairnessByRole {
  role: "CHIEF_INVIGILATOR" | "INVIGILATOR";
  staff: number;
  withoutDuty: number;
  minHours: number;
  averageHours: number;
  maxHours: number;
  score: number | null;
}

export interface DepartmentLoad {
  department: string;
  staff: number;
  sessions: number;
  hours: number;
  hoursPerPerson: number;
  shareOfHours: number;
}

export interface CoverageGap {
  assignmentId: UUID;
  examDate: string;
  slot: string;
  room: string;
  subject: string;
  requiredInvigilators: number;
  assignedInvigilators: number;
  chiefMissing: boolean;
}

export interface Coverage {
  examRooms: number;
  fullyStaffed: number;
  withGaps: number;
  missingInvigilators: number;
  missingChiefs: number;
  gaps: CoverageGap[];
}

export interface ScheduleAnalytics {
  scheduleGroupId: UUID;
  scheduleGroupName: string;
  fairness: FairnessByRole[];
  departments: DepartmentLoad[];
  coverage: Coverage;
}
