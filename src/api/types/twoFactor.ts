import type { ISOInstant } from "./api";

/** The signed-in user's own two-step sign-in. */
export interface TwoFactorStatus {
  /** False when the server has no encryption key yet: two-step sign-in cannot be switched on. */
  available: boolean;
  enabled: boolean;
  enabledAt: ISOInstant | null;
  recoveryCodesLeft: number;
}

export interface TwoFactorSetup {
  /** The key for typing into the app by hand, in groups of four. */
  secret: string;
  /** Content of the QR code. */
  otpauthUri: string;
}

export interface RecoveryCodes {
  codes: string[];
}
