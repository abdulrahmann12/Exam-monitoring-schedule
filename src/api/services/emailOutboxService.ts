import type { BackendPaginatedResponse, EmailCounts, EmailLogEntry, NormalizedPaginatedResponse, ServiceResponse, UUID } from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const ENDPOINT = "/api/email-outbox";

async function getLog(page = 0, size = 50, status?: string): Promise<ServiceResponse<NormalizedPaginatedResponse<EmailLogEntry>>> {
  return performRequest<BackendPaginatedResponse<EmailLogEntry>, NormalizedPaginatedResponse<EmailLogEntry>>(
    { url: ENDPOINT, method: "GET", params: status ? { page, size, status } : { page, size } },
    normalizePaginatedResponse,
  );
}

async function getCounts(): Promise<ServiceResponse<EmailCounts>> {
  return performRequest<EmailCounts>({ url: `${ENDPOINT}/counts`, method: "GET" });
}

async function retry(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>({ url: `${ENDPOINT}/${id}/retry`, method: "POST" }, () => null);
}

async function retryAllFailed(): Promise<ServiceResponse<{ queued: number }>> {
  return performRequest<{ queued: number }>({ url: `${ENDPOINT}/retry-failed`, method: "POST" });
}

export const emailOutboxService = { getLog, getCounts, retry, retryAllFailed };
