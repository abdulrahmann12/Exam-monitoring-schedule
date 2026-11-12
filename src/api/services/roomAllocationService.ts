import type { BulkTemplateDownload, ImportDateOrder, RoomAllocationAdjustments, RoomAllocationBatch, RoomAllocationPreview, RoomAllocationSaved, RoomAllocationStaffed, RoomAllocationUndone, ServiceResponse, UUID } from "../types";
import { performRequest } from "../utils/request";

const ROOM_ALLOCATION_ENDPOINT = "/api/room-allocation";

/**
 * POST /api/room-allocation/preview
 * Uploads an exam list without rooms; the server proposes rooms. Nothing is saved.
 * 400 with row-level errors when a row is wrong.
 */
async function previewRoomAllocation(
  scheduleGroupId: UUID,
  file: File,
  dateOrder: ImportDateOrder = "AUTO",
  adjustments?: RoomAllocationAdjustments,
): Promise<ServiceResponse<RoomAllocationPreview>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scheduleGroupId", scheduleGroupId);
  if (dateOrder !== "AUTO") {
    formData.append("dateOrder", dateOrder);
  }
  if (adjustments && [adjustments.times, adjustments.rooms, adjustments.dates ?? {}, adjustments.anchors ?? {}].some((part) => Object.keys(part).length > 0)) {
    formData.append("adjustments", JSON.stringify(adjustments));
  }

  return performRequest<RoomAllocationPreview>({
    url: `${ROOM_ALLOCATION_ENDPOINT}/preview`,
    method: "POST",
    data: formData,
    timeout: 120_000,
    headers: {
      Accept: "application/json",
      "Content-Type": "multipart/form-data",
    },
  });
}

/** GET /api/room-allocation/template: Excel template whose Time Slot column lists this university's time slots. */
async function downloadTemplate(): Promise<ServiceResponse<BulkTemplateDownload>> {
  return performRequest<Blob, BulkTemplateDownload>(
    {
      url: `${ROOM_ALLOCATION_ENDPOINT}/template`,
      method: "GET",
      responseType: "blob",
      timeout: 60_000,
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    },
    (blob) => ({ blob, fileName: "exam-list-template.xlsx" }),
  );
}

/** POST /api/room-allocation/save: plans again from the same file and saves the rooms (no staff yet). */
async function saveRoomAllocation(
  scheduleGroupId: UUID,
  file: File,
  dateOrder: ImportDateOrder = "AUTO",
  adjustments?: RoomAllocationAdjustments,
): Promise<ServiceResponse<RoomAllocationSaved>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scheduleGroupId", scheduleGroupId);
  if (dateOrder !== "AUTO") {
    formData.append("dateOrder", dateOrder);
  }
  if (adjustments && [adjustments.times, adjustments.rooms, adjustments.dates ?? {}, adjustments.anchors ?? {}].some((part) => Object.keys(part).length > 0)) {
    formData.append("adjustments", JSON.stringify(adjustments));
  }
  return performRequest<RoomAllocationSaved>({
    url: `${ROOM_ALLOCATION_ENDPOINT}/save`,
    method: "POST",
    data: formData,
    timeout: 120_000,
    headers: { Accept: "application/json", "Content-Type": "multipart/form-data" },
  });
}

/** POST /api/room-allocation/staff: "Create schedule" for the saved exam rooms. */
async function staffRoomAllocation(scheduleGroupId: UUID, assignmentIds: UUID[]): Promise<ServiceResponse<RoomAllocationStaffed>> {
  return performRequest<RoomAllocationStaffed>({
    url: `${ROOM_ALLOCATION_ENDPOINT}/staff`,
    method: "POST",
    data: { scheduleGroupId, assignmentIds },
    timeout: 120_000,
  });
}

/** GET /api/room-allocation/batches: saved allocations of an exam period, newest first. */
async function listBatches(scheduleGroupId: UUID): Promise<ServiceResponse<RoomAllocationBatch[]>> {
  return performRequest<RoomAllocationBatch[]>({ url: `${ROOM_ALLOCATION_ENDPOINT}/batches`, method: "GET", params: { scheduleGroupId } });
}

/** POST /api/room-allocation/batches/{id}/undo: deletes that save's exam rooms and their staff. */
async function undoBatch(id: UUID): Promise<ServiceResponse<RoomAllocationUndone>> {
  return performRequest<RoomAllocationUndone>({ url: `${ROOM_ALLOCATION_ENDPOINT}/batches/${id}/undo`, method: "POST", data: {} });
}

function fileNameFrom(contentDisposition: string | undefined, fallback: string) {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1] ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : fallback;
}

/** GET /api/room-allocation/batches/{id}/door-sheets (PDF) or /export (Excel) of a saved allocation. */
async function downloadBatchFile(id: UUID, kind: "door-sheets" | "export"): Promise<ServiceResponse<BulkTemplateDownload>> {
  const fallback = kind === "door-sheets" ? "door-sheets.pdf" : "room-allocation.xlsx";
  return performRequest<Blob, BulkTemplateDownload>(
    { url: `${ROOM_ALLOCATION_ENDPOINT}/batches/${id}/${kind}`, method: "GET", responseType: "blob", timeout: 120_000 },
    (blob, response) => ({ blob, fileName: fileNameFrom(response.headers["content-disposition"], fallback) }),
  );
}

export const roomAllocationService = {
  downloadBatchFile,
  listBatches,
  undoBatch,
  previewRoomAllocation,
  saveRoomAllocation,
  staffRoomAllocation,
  downloadTemplate,
};
