import { apiClient } from "../client";
import type { ScheduleAnalytics, ServiceResponse, UUID, WorkloadReport } from "../types";
import { normalizeApiError } from "../utils/errorHandler";
import { performRequest } from "../utils/request";
import { createErrorResponse, createSuccessResponse } from "../utils/serviceResponse";

const ENDPOINT = "/api/reports";

async function getWorkload(scheduleGroupId: UUID): Promise<ServiceResponse<WorkloadReport>> {
  return performRequest<WorkloadReport>({ url: `${ENDPOINT}/workload`, method: "GET", params: { scheduleGroupId } });
}

async function getAnalytics(scheduleGroupId: UUID): Promise<ServiceResponse<ScheduleAnalytics>> {
  return performRequest<ScheduleAnalytics>({ url: `${ENDPOINT}/analytics`, method: "GET", params: { scheduleGroupId } });
}

/** Downloads sessions and hours per person as a CSV file for Excel. */
async function exportWorkloadCsv(scheduleGroupId: UUID, periodName: string): Promise<ServiceResponse<null>> {
  try {
    const response = await apiClient.get<Blob>(`${ENDPOINT}/workload/export`, { params: { scheduleGroupId }, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    const slug = periodName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "exam-period";
    link.download = `workload-${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return createSuccessResponse<null>(null);
  } catch (error) {
    return createErrorResponse<null>(normalizeApiError(error));
  }
}

export const reportsService = { getWorkload, getAnalytics, exportWorkloadCsv };
