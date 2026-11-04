import type { ISOInstant } from "./api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: ISOInstant;
  email: string;
}

export interface CurrentSession {
  email: string;
  roles: string[];
}

export type AuthSession = AuthResponse;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
