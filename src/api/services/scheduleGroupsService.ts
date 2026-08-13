import type {
  BackendPaginatedResponse,
  NormalizedPaginatedResponse,
  ScheduleGroup,
  ScheduleGroupRequest,
  ScheduleGroupsQuery,
  ScheduleNotifyResult,
  ServiceResponse,
  UUID,
} from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const SCHEDULE_GROUPS_ENDPOINT = "/api/schedule-groups";

async function getScheduleGroups(
  params?: ScheduleGroupsQuery,
): Promise<ServiceResponse<NormalizedPaginatedResponse<ScheduleGroup>>> {
  return performRequest<BackendPaginatedResponse<ScheduleGroup>, NormalizedPaginatedResponse<ScheduleGroup>>(
    {
      url: SCHEDULE_GROUPS_ENDPOINT,
      method: "GET",
      params,
    },
    normalizePaginatedResponse,
  );
}

async function getScheduleGroup(id: UUID): Promise<ServiceResponse<ScheduleGroup>> {
  return performRequest<ScheduleGroup>({
    url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}`,
    method: "GET",
  });
}

async function createScheduleGroup(payload: ScheduleGroupRequest): Promise<ServiceResponse<ScheduleGroup>> {
  return performRequest<ScheduleGroup>({
    url: SCHEDULE_GROUPS_ENDPOINT,
    method: "POST",
    data: payload,
  });
}

async function updateScheduleGroup(
  id: UUID,
  payload: ScheduleGroupRequest,
): Promise<ServiceResponse<ScheduleGroup>> {
  return performRequest<ScheduleGroup>({
    url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}`,
    method: "PUT",
    data: payload,
  });
}

async function notifyAssignedStaff(id: UUID): Promise<ServiceResponse<ScheduleNotifyResult>> {
  return performRequest<ScheduleNotifyResult>({
    url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}/notify`,
    method: "POST",
  });
}

async function deleteScheduleGroup(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    {
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}`,
      method: "DELETE",
    },
    () => null,
  );
}

export const scheduleGroupsService = {
  getScheduleGroups,
  getScheduleGroup,
  createScheduleGroup,
  updateScheduleGroup,
  deleteScheduleGroup,
  notifyAssignedStaff,
};
