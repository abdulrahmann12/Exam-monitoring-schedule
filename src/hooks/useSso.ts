import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UniversitySso, UUID } from "@/api";
import { ssoService } from "@/api";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

/** Public list of sign-in options; an empty list (or an error) simply shows no buttons. */
export function useSsoProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.sso.providers,
    queryFn: async () => unwrapServiceResponse(await ssoService.getProviders()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useSsoConnectionsQuery() {
  return useQuery({
    queryKey: queryKeys.sso.connections,
    queryFn: async () => unwrapServiceResponse(await ssoService.getConnections()),
  });
}

export function useLinkSsoMutation() {
  return useMutation({
    mutationFn: async ({ provider, currentPassword, returnPath }: { provider: string; currentPassword: string; returnPath: "/settings" | "/owner" }) =>
      unwrapServiceResponse(await ssoService.link(provider, currentPassword, returnPath)),
  });
}

export function useDisconnectSsoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: UUID) => unwrapServiceResponse(await ssoService.disconnect(id)),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sso.connections });
    },
  });
}

export function useUniversitySsoQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sso.university,
    queryFn: async () => unwrapServiceResponse(await ssoService.getUniversitySettings()),
    enabled,
  });
}

export function useUpdateUniversitySsoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UniversitySso) => unwrapServiceResponse(await ssoService.updateUniversitySettings(payload)),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sso.university });
    },
  });
}
