import type { RoomCategory, RoomCategoryRequest, ServiceResponse, UUID } from "../types";
import { performRequest } from "../utils/request";

const ROOM_CATEGORIES_ENDPOINT = "/api/room-categories";

/** GET /api/room-categories: the university's room types, in display order. */
async function getRoomCategories(): Promise<ServiceResponse<RoomCategory[]>> {
  return performRequest<RoomCategory[]>({ url: ROOM_CATEGORIES_ENDPOINT, method: "GET" });
}

async function createRoomCategory(payload: RoomCategoryRequest): Promise<ServiceResponse<RoomCategory>> {
  return performRequest<RoomCategory>({ url: ROOM_CATEGORIES_ENDPOINT, method: "POST", data: payload });
}

async function updateRoomCategory(id: UUID, payload: RoomCategoryRequest): Promise<ServiceResponse<RoomCategory>> {
  return performRequest<RoomCategory>({ url: `${ROOM_CATEGORIES_ENDPOINT}/${id}`, method: "PUT", data: payload });
}

/** 409 when rooms still have this type. */
async function deleteRoomCategory(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<null>({ url: `${ROOM_CATEGORIES_ENDPOINT}/${id}`, method: "DELETE" }, () => null);
}

export const roomCategoriesService = {
  getRoomCategories,
  createRoomCategory,
  updateRoomCategory,
  deleteRoomCategory,
};
