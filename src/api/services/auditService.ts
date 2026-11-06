import { apiClient } from "../client";
import type { AuditEvent, AuditQuery, BackendPaginatedResponse, NormalizedPaginatedResponse, ServiceResponse } from "../types";
import { normalizeApiError } from "../utils/errorHandler";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";
import { createErrorResponse, createSuccessResponse } from "../utils/serviceResponse";

const AUDIT_ENDPOINT = "/api/audit-events";

/** Drops empty filters so they are not sent as "?actor=". */
function cleanParams(query: AuditQuery): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as Record<string, string | number>;
}

async function getEvents(query: AuditQuery): Promise<ServiceResponse<NormalizedPaginatedResponse<AuditEvent>>> {
  return performRequest<BackendPaginatedResponse<AuditEvent>, NormalizedPaginatedResponse<AuditEvent>>(
    { url: AUDIT_ENDPOINT, method: "GET", params: cleanParams(query) },
    normalizePaginatedResponse,
  );
}

/** Downloads the filtered log as a CSV file (newest first, up to 10,000 entries). */
async function exportCsv(query: AuditQuery): Promise<ServiceResponse<null>> {
  try {
    const { page: _page, size: _size, ...filters } = query;
    const response = await apiClient.get<Blob>(`${AUDIT_ENDPOINT}/export`, { params: cleanParams(filters), responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return createSuccessResponse<null>(null);
  } catch (error) {
    return createErrorResponse<null>(normalizeApiError(error));
  }
}

export const auditService = {
  getEvents,
  exportCsv,
};
