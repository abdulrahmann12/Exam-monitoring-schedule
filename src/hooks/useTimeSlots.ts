import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { TimeSlotRequest, TimeSlotsQuery, UUID } from "@/api";
import { timeSlotsService } from "@/services";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const defaultTimeSlotParams: TimeSlotsQuery = {
  page: 0,
  size: 100,
  sortBy: "sortOrder",
  direction: "ASC",
};

const TIME_SLOTS_ENDPOINT = "/api/slots";

function useScopedTimeSlotParams(params: TimeSlotsQuery = defaultTimeSlotParams): TimeSlotsQuery {
  const { activeGroupId } = useScheduleGroup();
  return {
    ...defaultTimeSlotParams,
    ...params,
    scheduleGroupId: params.scheduleGroupId ?? activeGroupId ?? undefined,
  };
}

export function useTimeSlotsQuery(params: TimeSlotsQuery = defaultTimeSlotParams) {
  const scopedParams = useScopedTimeSlotParams(params);

  return useQuery({
    queryKey: queryKeys.timeSlots.list(scopedParams),
    queryFn: async () => unwrapServiceResponse(await timeSlotsService.getTimeSlots(scopedParams)),
    enabled: Boolean(scopedParams.scheduleGroupId),
    refetchOnWindowFocus: true,
  });
}

export function useCreateTimeSlotMutation() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useScheduleGroup();

  return useSafeMutation({
    getFingerprint: (payload: TimeSlotRequest) => ({
      data: payload,
      method: "POST",
      url: TIME_SLOTS_ENDPOINT,
    }),
    mutationFn: async (payload: TimeSlotRequest) =>
      unwrapServiceResponse(await timeSlotsService.createTimeSlot({
        ...payload,
        scheduleGroupId: payload.scheduleGroupId ?? activeGroupId ?? undefined,
      })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useUpdateTimeSlotMutation() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useScheduleGroup();

  return useSafeMutation({
    getFingerprint: ({ id, payload }: { id: UUID; payload: TimeSlotRequest }) => ({
      data: payload,
      method: "PUT",
      resourceId: id,
      url: `${TIME_SLOTS_ENDPOINT}/${id}`,
    }),
    mutationFn: async ({ id, payload }: { id: UUID; payload: TimeSlotRequest }) =>
      unwrapServiceResponse(await timeSlotsService.updateTimeSlot(id, {
        ...payload,
        scheduleGroupId: payload.scheduleGroupId ?? activeGroupId ?? undefined,
      })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useDeactivateTimeSlotMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "PATCH",
      resourceId: id,
      url: `${TIME_SLOTS_ENDPOINT}/${id}/deactivate`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await timeSlotsService.deactivateTimeSlot(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}

export function useDeleteTimeSlotMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "DELETE",
      resourceId: id,
      url: `${TIME_SLOTS_ENDPOINT}/${id}`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await timeSlotsService.deleteTimeSlot(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
    },
  });
}