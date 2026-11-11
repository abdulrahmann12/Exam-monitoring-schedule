import type { BulkTemplateDownload, ImportDateOrder, RoomAllocationPreview, RoomAllocationSaved, RoomAllocationStaffed, ServiceResponse, UUID } from "../types";
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
): Promise<ServiceResponse<RoomAllocationPreview>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scheduleGroupId", scheduleGroupId);
  if (dateOrder !== "AUTO") {
    formData.append("dateOrder", dateOrder);
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
): Promise<ServiceResponse<RoomAllocationSaved>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scheduleGroupId", scheduleGroupId);
  if (dateOrder !== "AUTO") {
    formData.append("dateOrder", dateOrder);
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

export const roomAllocationService = {
  previewRoomAllocation,
  saveRoomAllocation,
  staffRoomAllocation,
  downloadTemplate,
};
