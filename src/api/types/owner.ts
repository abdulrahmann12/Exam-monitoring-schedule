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
