import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { AssignmentRequest, AssignmentsQuery, UUID } from "@/api";
import { assignmentsService } from "@/services";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { getErrorMessage } from "@/utils/error";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const defaultAssignmentsParams: AssignmentsQuery = {
  page: 0,
  size: 100,
  sortBy: "examDate",
  direction: "ASC",
};

interface DeleteAllAssignmentsResult {
  total: number;
  deleted: number;
  failed: number;
  firstError?: string;
}

const ASSIGNMENTS_ENDPOINT = "/api/assignments";

function useScopedAssignmentParams(params: AssignmentsQuery = defaultAssignmentsParams): AssignmentsQuery {
  const { activeGroupId } = useScheduleGroup();
  return {
    ...defaultAssignmentsParams,
    ...params,
    scheduleGroupId: params.scheduleGroupId ?? activeGroupId ?? undefined,
  };
}

async function fetchAllAssignments(params: AssignmentsQuery = defaultAssignmentsParams) {
  const pageSize = Math.max(1, Math.trunc(params.size ?? defaultAssignmentsParams.size ?? 100));
  const baseParams = {
    ...params,
    page: 0,
    size: pageSize,
  } satisfies AssignmentsQuery;

  const firstPage = unwrapServiceResponse(await assignmentsService.getAssignments(baseParams));
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.totalItems > 0 ? Math.ceil(firstPage.totalItems / pageSize) : 0,
  );

  if (totalPages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, async (_, index) =>
      unwrapServiceResponse(await assignmentsService.getAssignments({
        ...baseParams,
        page: index + 1,
      }))),
  );

  return [
    ...firstPage.items,
    ...remainingPages.flatMap((page) => page.items),
  ];
}

export function useAssignmentsQuery(params: AssignmentsQuery = defaultAssignmentsParams) {
  const scopedParams = useScopedAssignmentParams(params);

  return useQuery({
    queryKey: queryKeys.assignments.list(scopedParams),
    queryFn: async () => unwrapServiceResponse(await assignmentsService.getAssignments(scopedParams)),
    enabled: Boolean(scopedParams.scheduleGroupId),
    refetchOnWindowFocus: true,
  });
}

export function useCreateAssignmentMutation() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useScheduleGroup();

  return useSafeMutation({
    getFingerprint: (payload: AssignmentRequest) => ({
      data: payload,
      method: "POST",
      url: ASSIGNMENTS_ENDPOINT,
    }),
    mutationFn: async (payload: AssignmentRequest) =>
      unwrapServiceResponse(await assignmentsService.createAssignment({
        ...payload,
        scheduleGroupId: payload.scheduleGroupId ?? activeGroupId ?? undefined,
      })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}

export function useUpdateAssignmentMutation() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useScheduleGroup();

  return useSafeMutation({
    getFingerprint: ({ id, payload }: { id: UUID; payload: AssignmentRequest }) => ({
      data: payload,
      method: "PUT",
      resourceId: id,
      url: `${ASSIGNMENTS_ENDPOINT}/${id}`,
    }),
    mutationFn: async ({ id, payload }: { id: UUID; payload: AssignmentRequest }) =>
      unwrapServiceResponse(await assignmentsService.updateAssignment(id, {
        ...payload,
        scheduleGroupId: payload.scheduleGroupId ?? activeGroupId ?? undefined,
      })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}

export function useDeleteAssignmentMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (id: UUID) => ({
      method: "DELETE",
      resourceId: id,
      url: `${ASSIGNMENTS_ENDPOINT}/${id}`,
    }),
    mutationFn: async (id: UUID) => unwrapServiceResponse(await assignmentsService.deleteAssignment(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}

export function useDeleteAllAssignmentsMutation() {
  const queryClient = useQueryClient();
  const scopedParams = useScopedAssignmentParams(defaultAssignmentsParams);

  return useSafeMutation<DeleteAllAssignmentsResult, Error, void>({
    getFingerprint: () => ({
      method: "DELETE",
      url: ASSIGNMENTS_ENDPOINT,
    }),
    mutationFn: async () => {
      const assignments = await fetchAllAssignments(scopedParams);
      let deleted = 0;
      let firstError: string | undefined;

      for (const assignment of assignments) {
        try {
          await unwrapServiceResponse(await assignmentsService.deleteAssignment(assignment.id));
          deleted += 1;
        } catch (errorValue) {
          firstError ??= getErrorMessage(errorValue);
        }
      }

      return {
        total: assignments.length,
        deleted,
        failed: assignments.length - deleted,
        firstError,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    },
  });
}