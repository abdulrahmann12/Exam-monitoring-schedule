import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ScheduleGroupRequest, ScheduleGroupsQuery, UUID } from "@/api";
import { scheduleGroupsService } from "@/services";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const defaultScheduleGroupParams: ScheduleGroupsQuery = {
  page: 0,
  size: 100,
  sortBy: "createdAt",
  direction: "ASC",
};

const SCHEDULE_GROUPS_ENDPOINT = "/api/schedule-groups";

export function useScheduleGroupsQuery(
  params: ScheduleGroupsQuery = defaultScheduleGroupParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.scheduleGroups.list(params),
    queryFn: async () => unwrapServiceResponse(await scheduleGroupsService.getScheduleGroups(params)),
    enabled: options?.enabled ?? true,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: true,
  });
}

export function useCreateScheduleGroupMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (payload: ScheduleGroupRequest) => ({
      data: payload,
      method: "POST",
      url: SCHEDULE_GROUPS_ENDPOINT,
    }),
    mutationFn: async (payload: ScheduleGroupRequest) =>
      unwrapServiceResponse(await scheduleGroupsService.createScheduleGroup(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleGroups.all });
    },
  });
}

export function useUpdateScheduleGroupMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: ({ id, payload }: { id: UUID; payload: ScheduleGroupRequest }) => ({
      data: payload,
      method: "PUT",
      resourceId: id,
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}`,
    }),
    mutationFn: async ({ id, payload }: { id: UUID; payload: ScheduleGroupRequest }) =>
      unwrapServiceResponse(await scheduleGroupsService.updateScheduleGroup(id, payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleGroups.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

export function useNotifyScheduleGroupMutation() {
  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "POST",
      resourceId: id,
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}/notify`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await scheduleGroupsService.notifyAssignedStaff(id)),
  });
}

export function useDeleteScheduleGroupMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "DELETE",
      resourceId: id,
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${id}`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await scheduleGroupsService.deleteScheduleGroup(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleGroups.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}
