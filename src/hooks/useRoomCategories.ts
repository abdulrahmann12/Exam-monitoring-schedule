import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RoomCategoryRequest, UUID } from "@/api";
import { roomCategoriesService } from "@/api/services/roomCategoriesService";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const ENDPOINT = "/api/room-categories";

/** The university's room types ("Classroom", "Computer Lab", ...). */
export function useRoomCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.roomCategories.all,
    queryFn: async () => unwrapServiceResponse(await roomCategoriesService.getRoomCategories()),
  });
}

/** Room types change how rooms are shown, so both lists are refreshed. */
function useRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.roomCategories.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
  };
}

export function useCreateRoomCategoryMutation() {
  const refresh = useRefresh();
  return useSafeMutation({
    getFingerprint: (payload: RoomCategoryRequest) => ({ data: payload, method: "POST", url: ENDPOINT }),
    mutationFn: async (payload: RoomCategoryRequest) => unwrapServiceResponse(await roomCategoriesService.createRoomCategory(payload)),
    onSuccess: refresh,
  });
}

export function useUpdateRoomCategoryMutation() {
  const refresh = useRefresh();
  return useSafeMutation({
    getFingerprint: ({ id, payload }: { id: UUID; payload: RoomCategoryRequest }) => ({ data: payload, method: "PUT", resourceId: id, url: `${ENDPOINT}/${id}` }),
    mutationFn: async ({ id, payload }: { id: UUID; payload: RoomCategoryRequest }) =>
      unwrapServiceResponse(await roomCategoriesService.updateRoomCategory(id, payload)),
    onSuccess: refresh,
  });
}

export function useDeleteRoomCategoryMutation() {
  const refresh = useRefresh();
  return useSafeMutation({
    getFingerprint: (id: UUID) => ({ method: "DELETE", resourceId: id, url: `${ENDPOINT}/${id}` }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await roomCategoriesService.deleteRoomCategory(id)),
    onSuccess: refresh,
  });
}
