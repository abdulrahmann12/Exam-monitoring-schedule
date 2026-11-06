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
  getAssignments,
  createAssignment,
  saveAssignmentsBulk,
  generatePreview,
  updateAssignment,
  deleteAssignment,
};