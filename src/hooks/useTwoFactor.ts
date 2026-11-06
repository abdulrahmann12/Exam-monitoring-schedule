import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { twoFactorService } from "@/api";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

export function useTwoFactorStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.twoFactor.status,
    queryFn: async () => unwrapServiceResponse(await twoFactorService.getStatus()),
    enabled,
  });
}

function useTwoFactorMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.twoFactor.status });
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
}

export function useStartTwoFactorSetupMutation() {
  return useMutation({
    mutationFn: async (currentPassword: string) => unwrapServiceResponse(await twoFactorService.startSetup(currentPassword)),
  });
}

export function useEnableTwoFactorMutation() {
  return useTwoFactorMutation(async (code: string) => unwrapServiceResponse(await twoFactorService.enable(code)));
}

export function useDisableTwoFactorMutation() {
  return useTwoFactorMutation(async ({ currentPassword, code }: { currentPassword: string; code: string }) =>
    unwrapServiceResponse(await twoFactorService.disable(currentPassword, code)));
}

export function useNewRecoveryCodesMutation() {
  return useTwoFactorMutation(async ({ currentPassword, code }: { currentPassword: string; code: string }) =>
    unwrapServiceResponse(await twoFactorService.newRecoveryCodes(currentPassword, code)));
}
