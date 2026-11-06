import type { AuthResponse, RecoveryCodes, ServiceResponse, TwoFactorSetup, TwoFactorStatus } from "../types";
import { performRequest } from "../utils/request";

const ENDPOINT = "/api/auth/2fa";

/** Second step of sign-in: the code from the authenticator app, or a recovery code. */
async function verify(code: string): Promise<ServiceResponse<AuthResponse>> {
  return performRequest<AuthResponse>({ url: `${ENDPOINT}/verify`, method: "POST", data: { code } });
}

async function getStatus(): Promise<ServiceResponse<TwoFactorStatus>> {
  return performRequest<TwoFactorStatus>({ url: ENDPOINT, method: "GET" });
}

async function startSetup(currentPassword: string): Promise<ServiceResponse<TwoFactorSetup>> {
  return performRequest<TwoFactorSetup>({ url: `${ENDPOINT}/setup`, method: "POST", data: { currentPassword } });
}

async function enable(code: string): Promise<ServiceResponse<RecoveryCodes>> {
  return performRequest<RecoveryCodes>({ url: `${ENDPOINT}/enable`, method: "POST", data: { code } });
}

async function disable(currentPassword: string, code: string): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>({ url: `${ENDPOINT}/disable`, method: "POST", data: { currentPassword, code } }, () => null);
}

async function newRecoveryCodes(currentPassword: string, code: string): Promise<ServiceResponse<RecoveryCodes>> {
  return performRequest<RecoveryCodes>({ url: `${ENDPOINT}/recovery-codes`, method: "POST", data: { currentPassword, code } });
}

export const twoFactorService = {
  verify,
  getStatus,
  startSetup,
  enable,
  disable,
  newRecoveryCodes,
};
