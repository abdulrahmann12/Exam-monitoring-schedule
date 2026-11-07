import type {
  BackendPaginatedResponse,
  NormalizedPaginatedResponse,
  ServiceResponse,
  TimeSlot,
  TimeSlotRequest,
  TimeSlotsQuery,
  UUID,
} from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const TIME_SLOTS_ENDPOINT = "/api/slots";

async function getTimeSlots(
  params?: TimeSlotsQuery,
): Promise<ServiceResponse<NormalizedPaginatedResponse<TimeSlot>>> {
  return performRequest<BackendPaginatedResponse<TimeSlot>, NormalizedPaginatedResponse<TimeSlot>>(
    {
      url: TIME_SLOTS_ENDPOINT,
      method: "GET",
      params,
    },
    normalizePaginatedResponse,
  );
}

async function createTimeSlot(payload: TimeSlotRequest): Promise<ServiceResponse<TimeSlot>> {
  return performRequest<TimeSlot>({
    url: TIME_SLOTS_ENDPOINT,
    method: "POST",
    data: payload,
  });
}

async function updateTimeSlot(id: UUID, payload: TimeSlotRequest): Promise<ServiceResponse<TimeSlot>> {
  return performRequest<TimeSlot>({
    url: `${TIME_SLOTS_ENDPOINT}/${id}`,
    method: "PUT",
    data: payload,
  });
}

async function deleteTimeSlot(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    {
      url: `${TIME_SLOTS_ENDPOINT}/${id}`,
      method: "DELETE",
    },
    () => null,
  );
}

async function deactivateTimeSlot(id: UUID): Promise<ServiceResponse<TimeSlot>> {
  return performRequest<TimeSlot>({
    url: `${TIME_SLOTS_ENDPOINT}/${id}/deactivate`,
    method: "PATCH",
  });
}

/** Undo a deactivation. */
async function activateTimeSlot(id: UUID): Promise<ServiceResponse<TimeSlot>> {
  return performRequest<TimeSlot>({
    url: `${TIME_SLOTS_ENDPOINT}/${id}/activate`,
    method: "PATCH",
  });
}

export const timeSlotsService = {
  activateTimeSlot,
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  deactivateTimeSlot,
};