import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AddUniversityAdminRequest, CreateUniversityRequest, UpdateUniversityRequest, UUID } from "@/api";
import { ownerService } from "@/api";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

export function useOwnerOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.owner.overview,
    queryFn: async () => unwrapServiceResponse(await ownerService.getOverview()),
  });
}

export function useOwnerActivityQuery(page = 0, size = 50) {
  return useQuery({
    queryKey: [...queryKeys.owner.activity, page, size],
    queryFn: async () => unwrapServiceResponse(await ownerService.getActivity(page, size)),
    placeholderData: keepPreviousData,
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

export function useResetAdminTwoFactorMutation() {
  return useOwnerMutation(async ({ universityId, userId }: { universityId: UUID; userId: UUID }) =>
    unwrapServiceResponse(await ownerService.resetAdminTwoFactor(universityId, userId)));
}
