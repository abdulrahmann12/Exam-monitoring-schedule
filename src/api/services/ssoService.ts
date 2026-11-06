import { API_BASE_URL } from "../client";
import type { ServiceResponse, SsoConnection, SsoProvider, UniversitySso, UUID } from "../types";
import { performRequest } from "../utils/request";

const ENDPOINT = "/api/auth/sso";

async function getProviders(): Promise<ServiceResponse<SsoProvider[]>> {
  return performRequest<SsoProvider[]>({ url: `${ENDPOINT}/providers`, method: "GET" });
}

/** The page navigates here (a full page load): the server sends the browser on to Microsoft / Google. */
function startUrl(provider: string): string {
  return `${API_BASE_URL}${ENDPOINT}/${encodeURIComponent(provider)}/start`;
}

/** Connect an account of this provider to the signed-in account; answers the address to navigate to. */
async function link(provider: string, currentPassword: string, returnPath: "/settings" | "/owner"): Promise<ServiceResponse<{ url: string }>> {
  return performRequest<{ url: string }>({
    url: `${ENDPOINT}/${encodeURIComponent(provider)}/link`,
    method: "POST",
    data: { currentPassword, returnPath },
  });
}

async function getConnections(): Promise<ServiceResponse<SsoConnection[]>> {
  return performRequest<SsoConnection[]>({ url: `${ENDPOINT}/connections`, method: "GET" });
}

async function disconnect(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>({ url: `${ENDPOINT}/connections/${id}`, method: "DELETE" }, () => null);
}

async function getUniversitySettings(): Promise<ServiceResponse<UniversitySso>> {
  return performRequest<UniversitySso>({ url: `${ENDPOINT}/university`, method: "GET" });
}

async function updateUniversitySettings(payload: UniversitySso): Promise<ServiceResponse<UniversitySso>> {
  return performRequest<UniversitySso>({ url: `${ENDPOINT}/university`, method: "PUT", data: payload });
}

export const ssoService = {
  getProviders,
  startUrl,
  link,
  getConnections,
  disconnect,
  getUniversitySettings,
  updateUniversitySettings,
};
