import type {
  Assignment,
  BulkAssignmentRequest,
  AssignmentRequest,
  GeneratePreviewRequest,
  GeneratePreviewResponse,
  AssignmentsQuery,
  BackendPaginatedResponse,
  NormalizedPaginatedResponse,
  ServiceResponse,
  UUID,
} from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const ASSIGNMENTS_ENDPOINT = "/api/assignments";

async function getAssignments(
  params?: AssignmentsQuery,
): Promise<ServiceResponse<NormalizedPaginatedResponse<Assignment>>> {
  return performRequest<BackendPaginatedResponse<Assignment>, NormalizedPaginatedResponse<Assignment>>(
    {
      url: ASSIGNMENTS_ENDPOINT,
      method: "GET",
      params,
    },
    normalizePaginatedResponse,
  );
}

async function createAssignment(payload: AssignmentRequest): Promise<ServiceResponse<Assignment>> {
  return performRequest<Assignment>({
    url: ASSIGNMENTS_ENDPOINT,
    method: "POST",
    data: payload,
  });
}

async function saveAssignmentsBulk(
  payload: BulkAssignmentRequest[],
): Promise<ServiceResponse<Assignment[]>> {
  return performRequest<Assignment[]>({
    url: `${ASSIGNMENTS_ENDPOINT}/bulk`,
    method: "POST",
    data: payload,
  });
}

/** Server-side schedule generation for one date + slot. Nothing is saved. */
async function generatePreview(
  payload: GeneratePreviewRequest,
): Promise<ServiceResponse<GeneratePreviewResponse>> {
  return performRequest<GeneratePreviewResponse>({
    url: `${ASSIGNMENTS_ENDPOINT}/generate-preview`,
    method: "POST",
    data: payload,
  });
}

async function updateAssignment(
  id: UUID,
  payload: AssignmentRequest,
): Promise<ServiceResponse<Assignment>> {
  return performRequest<Assignment>({
    url: `${ASSIGNMENTS_ENDPOINT}/${id}`,
    method: "PUT",
    data: payload,
  });
}

/** Deletes every assignment of one exam period, all at once or not at all. */
async function deleteAllAssignments(scheduleGroupId: UUID): Promise<ServiceResponse<{ deleted: number; examPeriod: string }>> {
  return performRequest<{ deleted: number; examPeriod: string }>({ url: ASSIGNMENTS_ENDPOINT, method: "DELETE", params: { scheduleGroupId } });
}

async function deleteAssignment(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    {
      url: `${ASSIGNMENTS_ENDPOINT}/${id}`,
      method: "DELETE",
    },
    () => null,
  );
}

export const assignmentsService = {
  deleteAllAssignments,
  getAssignments,
  createAssignment,
  saveAssignmentsBulk,
  generatePreview,
  updateAssignment,
  deleteAssignment,
};