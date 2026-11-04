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
}