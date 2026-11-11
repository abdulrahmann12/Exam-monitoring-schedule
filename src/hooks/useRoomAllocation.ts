import { useQueryClient } from "@tanstack/react-query";

import type { ImportDateOrder, UUID } from "@/api";
import { roomAllocationService } from "@/api/services/roomAllocationService";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

interface PreviewRoomAllocationVariables {
  groupId: UUID;
  file: File;
  dateOrder?: ImportDateOrder;
}

/** `POST /api/room-allocation/preview`: proposes rooms for an exam list. Changes nothing, so nothing is invalidated. */
export function usePreviewRoomAllocationMutation() {
  return useSafeMutation({
    getFingerprint: ({ groupId }: PreviewRoomAllocationVariables) => ({
      method: "POST",
      resourceId: groupId,
      url: "/api/room-allocation/preview",
    }),
    mutationFn: async ({ groupId, file, dateOrder }: PreviewRoomAllocationVariables) =>
      unwrapServiceResponse(await roomAllocationService.previewRoomAllocation(groupId, file, dateOrder)),
  });
}

/** Saves the proposed rooms. New exam rooms and maybe new time slots: those lists are refreshed. */
export function useSaveRoomAllocationMutation() {
  const queryClient = useQueryClient();
  return useSafeMutation({
    getFingerprint: ({ groupId }: PreviewRoomAllocationVariables) => ({ method: "POST", resourceId: groupId, url: "/api/room-allocation/save" }),
    mutationFn: async ({ groupId, file, dateOrder }: PreviewRoomAllocationVariables) =>
      unwrapServiceResponse(await roomAllocationService.saveRoomAllocation(groupId, file, dateOrder)),
    onSuccess: async () => {
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
