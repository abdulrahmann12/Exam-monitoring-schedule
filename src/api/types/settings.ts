import type { UUID } from "./api";

export type ThemeMode = "LIGHT" | "DARK";

export interface SettingsRequest {
  systemName: string;
  appTagline?: string;
  logoUrl?: string | null;
  theme: ThemeMode;
  universityName: string;
  department?: string | null;
  examPeriod: string;
  /** Max separate duty sessions per person per day; 0 = unlimited. */
  maxDutiesPerDay?: number;
  /** Max duty sessions per person per exam period; 0 = unlimited. */
  maxDutiesPerPeriod?: number;
  /** Minimum break between two sessions of one person on a day (minutes); 0 = none. */
  minRestMinutes?: number;
  /** One invigilator per N students; 0 = use each room's minimum. */
  studentsPerInvigilator?: number;
  /** Rooms one chief invigilator may cover at the same time (1–10). */
  chiefMaxParallelRooms?: number;
}

export interface Settings {
  id: UUID;
  systemName: string;
  appTagline: string;
  logoUrl: string | null;
  theme: ThemeMode;
  universityName: string;
  department: string | null;
  examPeriod: string;
  maxDutiesPerDay: number;
  maxDutiesPerPeriod: number;
  minRestMinutes: number;
  studentsPerInvigilator: number;
  /** Rooms one chief invigilator may cover at the same time (1–10, default 2). */
  chiefMaxParallelRooms: number;
}