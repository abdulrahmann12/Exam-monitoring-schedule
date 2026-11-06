import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AddUniversityAdminRequest, CreateUniversityRequest, UpdateUniversityRequest, UUID } from "@/api";
import { ownerService } from "@/api";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

export function useOwnerOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.owner.overview,
    queryFn: async () => unwrapServiceResponse(await ownerService.getOverview()),
  });
}

export function useOwnerActivityQuery() {
  return useQuery({
    queryKey: queryKeys.owner.activity,
    queryFn: async () => unwrapServiceResponse(await ownerService.getActivity(0, 50)),
  });
}

function useOwnerMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.owner.all });
    },
  });
}

export function useCreateUniversityMutation() {
  return useOwnerMutation(async (payload: CreateUniversityRequest) => unwrapServiceResponse(await ownerService.createUniversity(payload)));
}

export function useUpdateUniversityMutation() {
  return useOwnerMutation(async ({ id, payload }: { id: UUID; payload: UpdateUniversityRequest }) =>
    unwrapServiceResponse(await ownerService.updateUniversity(id, payload)));
}

export function useAddUniversityAdminMutation() {
  return useOwnerMutation(async ({ id, payload }: { id: UUID; payload: AddUniversityAdminRequest }) =>
    unwrapServiceResponse(await ownerService.addAdmin(id, payload)));
}
