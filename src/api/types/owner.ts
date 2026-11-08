import type { ISOInstant, UUID } from "./api";

/** An administrator of a university, as the platform owner sees them. */
export interface OwnerUniversityAdmin {
  id: UUID;
  email: string;
  displayName: string | null;
  enabled: boolean;
  signedIn: boolean;
  invitationPending: boolean;
  twoFactorEnabled: boolean;
}

/** One university with its usage. Counts only: the owner never sees a university's data. */
export interface OwnerUniversity {
  id: UUID;
  name: string;
  slug: string;
  active: boolean;
  createdAt: ISOInstant;
  accounts: number;
  people: number;
  rooms: number;
  scheduledExamRooms: number;
  lastSignInAt: ISOInstant | null;
  lastActivityAt: ISOInstant | null;
  admins: OwnerUniversityAdmin[];
}

export interface OwnerTotals {
  universities: number;
  activeUniversities: number;
  accounts: number;
  people: number;
  scheduledExamRooms: number;
}

export interface OwnerOverview {
  totals: OwnerTotals;
  universities: OwnerUniversity[];
}

export interface CreateUniversityRequest {
  name: string;
  slug: string;
  adminEmail: string;
  adminName?: string;
}

export interface UpdateUniversityRequest {
  name: string;
  active: boolean;
}

/** Permanently delete a switched-off university: its exact name and the owner's password. */
export interface DeleteUniversityRequest {
  confirmName: string;
  password: string;
}

/** What a deletion removed (counts only). */
export interface DeletedUniversity {
  name: string;
  accounts: number;
  people: number;
  rooms: number;
  examRooms: number;
  emails: number;
}

/** The first university is re-created by the server on every start, so it can never be deleted. */
export const DEFAULT_UNIVERSITY_ID = "00000000-0000-0000-0000-000000000001";

export interface AddUniversityAdminRequest {
  email: string;
  displayName?: string;
}

/** Result of creating a university or inviting one of its administrators. */
export interface AdminInvitation {
  university: OwnerUniversity;
  adminEmail: string;
  inviteLink: string;
  inviteExpiresAt: ISOInstant;
  emailSent: boolean;
}
