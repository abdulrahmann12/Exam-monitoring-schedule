import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ImportDateOrder, RoomAllocationAdjustments, UUID } from "@/api";
import { roomAllocationService } from "@/api/services/roomAllocationService";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

interface PreviewRoomAllocationVariables {
  groupId: UUID;
  file: File;
  dateOrder?: ImportDateOrder;
  /** Changes made on the page before saving. */
  adjustments?: RoomAllocationAdjustments;
}

/** `POST /api/room-allocation/preview`: proposes rooms for an exam list. Changes nothing, so nothing is invalidated. */
export function usePreviewRoomAllocationMutation() {
  return useSafeMutation({
    getFingerprint: ({ groupId }: PreviewRoomAllocationVariables) => ({
      method: "POST",
      resourceId: groupId,
      url: "/api/room-allocation/preview",
    }),
    mutationFn: async ({ groupId, file, dateOrder, adjustments }: PreviewRoomAllocationVariables) =>
      unwrapServiceResponse(await roomAllocationService.previewRoomAllocation(groupId, file, dateOrder, adjustments)),
  });
}

/** Saves the proposed rooms. New exam rooms and maybe new time slots: those lists are refreshed. */
export function useSaveRoomAllocationMutation() {
  const queryClient = useQueryClient();
  return useSafeMutation({
    getFingerprint: ({ groupId }: PreviewRoomAllocationVariables) => ({ method: "POST", resourceId: groupId, url: "/api/room-allocation/save" }),
    mutationFn: async ({ groupId, file, dateOrder, adjustments }: PreviewRoomAllocationVariables) =>
      unwrapServiceResponse(await roomAllocationService.saveRoomAllocation(groupId, file, dateOrder, adjustments)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.roomAllocationBatches.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleGroups.all });
    },
  });
}

/** "Create schedule": assigns chiefs and invigilators to the saved exam rooms. */
export function useStaffRoomAllocationMutation() {
  const queryClient = useQueryClient();
  return useSafeMutation({
    getFingerprint: ({ groupId }: { groupId: UUID; assignmentIds: UUID[] }) => ({ method: "POST", resourceId: groupId, url: "/api/room-allocation/staff" }),
    mutationFn: async ({ groupId, assignmentIds }: { groupId: UUID; assignmentIds: UUID[] }) =>
      unwrapServiceResponse(await roomAllocationService.staffRoomAllocation(groupId, assignmentIds)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}

/** Saved allocations of an exam period (for Undo). */
export function useRoomAllocationBatchesQuery(groupId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.roomAllocationBatches.list(groupId),
    queryFn: async () => unwrapServiceResponse(await roomAllocationService.listBatches(groupId as UUID)),
    enabled: groupId != null,
  });
}

/** Undo one saved allocation. */
export function useUndoRoomAllocationMutation() {
  const queryClient = useQueryClient();
  return useSafeMutation({
    getFingerprint: (id: UUID) => ({ method: "POST", resourceId: id, url: `/api/room-allocation/batches/${id}/undo` }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await roomAllocationService.undoBatch(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.roomAllocationBatches.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}
