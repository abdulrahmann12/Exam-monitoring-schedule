import type {
  AddUniversityAdminRequest,
  AdminInvitation,
  AuditEvent,
  BackendPaginatedResponse,
  CreateUniversityRequest,
  NormalizedPaginatedResponse,
  OwnerOverview,
  OwnerUniversity,
  ServiceResponse,
  UpdateUniversityRequest,
  UUID,
} from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const OWNER_ENDPOINT = "/api/owner";

async function getOverview(): Promise<ServiceResponse<OwnerOverview>> {
  return performRequest<OwnerOverview>({ url: `${OWNER_ENDPOINT}/universities`, method: "GET" });
}

async function createUniversity(payload: CreateUniversityRequest): Promise<ServiceResponse<AdminInvitation>> {
  return performRequest<AdminInvitation>({ url: `${OWNER_ENDPOINT}/universities`, method: "POST", data: payload });
}

async function updateUniversity(id: UUID, payload: UpdateUniversityRequest): Promise<ServiceResponse<OwnerUniversity>> {
  return performRequest<OwnerUniversity>({ url: `${OWNER_ENDPOINT}/universities/${id}`, method: "PUT", data: payload });
}

/** Adds an administrator, or sends a fresh link to one who has not signed in yet. */
async function addAdmin(id: UUID, payload: AddUniversityAdminRequest): Promise<ServiceResponse<AdminInvitation>> {
  return performRequest<AdminInvitation>({ url: `${OWNER_ENDPOINT}/universities/${id}/admins`, method: "POST", data: payload });
}

/** A university administrator lost their phone: removes their two-step sign-in. */
async function resetAdminTwoFactor(universityId: UUID, userId: UUID): Promise<ServiceResponse<OwnerUniversity>> {
  return performRequest<OwnerUniversity>({ url: `${OWNER_ENDPOINT}/universities/${universityId}/admins/${userId}/reset-2fa`, method: "POST" });
}

async function getActivity(page = 0, size = 50): Promise<ServiceResponse<NormalizedPaginatedResponse<AuditEvent>>> {
  return performRequest<BackendPaginatedResponse<AuditEvent>, NormalizedPaginatedResponse<AuditEvent>>(
    { url: `${OWNER_ENDPOINT}/activity`, method: "GET", params: { page, size } },
    normalizePaginatedResponse,
  );
}

export const ownerService = {
  getOverview,
  createUniversity,
  updateUniversity,
  addAdmin,
  getActivity,
  resetAdminTwoFactor,
};
