import type {
  BackendPaginatedResponse,
  BulkTemplateDownload,
  NormalizedPaginatedResponse,
  ScheduleBulkUploadResult,
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
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function extractFileName(contentDisposition?: string, fallbackFileName = "schedule-bulk-template.xlsx"): string {
  if (!contentDisposition) return fallbackFileName;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";\/]+)/i);
  return match?.[1] ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : fallbackFileName;
}


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

/**
 * GET /api/schedule-groups/{id}/bulk-template
 * Downloads the Excel (.xlsx) schedule template for bulk upload.
 */
async function downloadBulkTemplate(id: UUID): Promise<ServiceResponse<BulkTemplateDownload>> {
  return performRequest<Blob, BulkTemplateDownload>(
    {
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}/bulk-template`,
      method: "GET",
      responseType: "blob",
      timeout: 60_000,
      headers: { Accept: XLSX_CONTENT_TYPE },
    },
    (blob, response) => ({
      blob,
      fileName: extractFileName(
        response.headers["content-disposition"],
        `schedule-bulk-template.xlsx`,
      ),
    }),
  );
}

/**
 * POST /api/schedule-groups/{id}/bulk-upload
 * Uploads a filled .xlsx schedule file.
 * Returns 200 on success (auto-assigns staff) or 400 with row-level errors.
 */
async function uploadBulkSchedule(
  id: UUID,
  file: File,
): Promise<ServiceResponse<ScheduleBulkUploadResult>> {
  const formData = new FormData();
  formData.append("file", file);

  return performRequest<ScheduleBulkUploadResult>(
    {
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}/bulk-upload`,
      method: "POST",
      data: formData,
      timeout: 120_000,
      headers: {
        Accept: "application/json",
        "Content-Type": "multipart/form-data",
      },
    },
  );
}

export const scheduleGroupsService = {
  getScheduleGroups,
  getScheduleGroup,
  createScheduleGroup,
  updateScheduleGroup,
  deleteScheduleGroup,
  notifyAssignedStaff,
  downloadBulkTemplate,
  uploadBulkSchedule,
};

