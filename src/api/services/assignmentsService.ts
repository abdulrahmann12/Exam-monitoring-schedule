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

/** One person who is not free at a date and time for a reason outside this exam period. */
export interface BusyElsewherePerson {
  personId: UUID;
  /** Invigilates in another exam period at an overlapping time. */
  invigilator: boolean;
  /** Rooms where the person is chief in another exam period at an overlapping time. */
  chiefRooms: number;
  onLeave: boolean;
  reason: string;
}

/** People busy at that date and time in other exam periods, or on leave (the server checks all periods). */
async function getBusyElsewhere(scheduleGroupId: UUID, date: string, slotId: UUID): Promise<ServiceResponse<{ people: BusyElsewherePerson[] }>> {
  return performRequest<{ people: BusyElsewherePerson[] }>({ url: `${ASSIGNMENTS_ENDPOINT}/busy-elsewhere`, method: "GET", params: { scheduleGroupId, date, slotId } });
}

export const assignmentsService = {
  getBusyElsewhere,
  deleteAllAssignments,
  getAssignments,
  createAssignment,
  saveAssignmentsBulk,
  generatePreview,
  updateAssignment,
  deleteAssignment,
};