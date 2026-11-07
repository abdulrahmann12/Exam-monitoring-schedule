import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { BulkDuplicateStrategy, RoomRequest, RoomsQuery, UUID } from "@/api";
import { bulkUploadService, roomsService } from "@/services";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";
import { fetchAllPaginatedItems } from "@/api/utils/pagination";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const defaultRoomsParams: RoomsQuery = {
  page: 0,
  size: 100,
  sortBy: "name",
  direction: "ASC",
};

const ROOMS_ENDPOINT = "/api/rooms";
const ROOMS_BULK_UPLOAD_ENDPOINT = "/api/bulk/rooms/upload";
const ROOMS_TEMPLATE_ENDPOINT = "/api/bulk/rooms/template";

export function useRoomsQuery(params: RoomsQuery = defaultRoomsParams) {
  return useQuery({
    queryKey: queryKeys.rooms.list(params),
    // Every page, not only the first 100: lists must never be cut off silently.
    queryFn: async () => fetchAllPaginatedItems(params, async (pageParams) => unwrapServiceResponse(await roomsService.getRooms(pageParams))),
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: true,
  });
}

export function useCreateRoomMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (payload: RoomRequest) => ({
      data: payload,
      method: "POST",
      url: ROOMS_ENDPOINT,
    }),
    mutationFn: async (payload: RoomRequest) => unwrapServiceResponse(await roomsService.createRoom(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useUpdateRoomMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: ({ id, payload }: { id: UUID; payload: RoomRequest }) => ({
      data: payload,
      method: "PUT",
      resourceId: id,
      url: `${ROOMS_ENDPOINT}/${id}`,
    }),
    mutationFn: async ({ id, payload }: { id: UUID; payload: RoomRequest }) =>
      unwrapServiceResponse(await roomsService.updateRoom(id, payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useDeleteRoomMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "DELETE",
      resourceId: id,
      url: `${ROOMS_ENDPOINT}/${id}`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await roomsService.deleteRoom(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useUploadRoomsBulkMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: ({ file, duplicateStrategy }: { file: File; duplicateStrategy: BulkDuplicateStrategy }) => ({
      data: { duplicateStrategy, file },
      method: "POST",
      params: { duplicateStrategy },
      url: ROOMS_BULK_UPLOAD_ENDPOINT,
    }),
    mutationFn: async ({ file, duplicateStrategy }: { file: File; duplicateStrategy: BulkDuplicateStrategy }) =>
      unwrapServiceResponse(await bulkUploadService.uploadRooms(file, duplicateStrategy)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useDownloadRoomsTemplateMutation() {
  return useSafeMutation({
    getFingerprint: () => ({
      method: "GET",
      url: ROOMS_TEMPLATE_ENDPOINT,
    }),
    mutationFn: async () => unwrapServiceResponse(await bulkUploadService.downloadRoomsTemplate()),
  });
}