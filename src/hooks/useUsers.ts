import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateUserRequest, UpdateUserRequest, UUID } from "@/api";
import { usersService } from "@/services";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => unwrapServiceResponse(await usersService.getUsers()),
    enabled,
  });
}

function useUsersMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useCreateUserMutation() {
  return useUsersMutation(async (payload: CreateUserRequest) => unwrapServiceResponse(await usersService.createUser(payload)));
}

export function useUpdateUserMutation() {
  return useUsersMutation(async ({ id, payload }: { id: UUID; payload: UpdateUserRequest }) =>
    unwrapServiceResponse(await usersService.updateUser(id, payload)));
}

export function useUnlockUserMutation() {
  return useUsersMutation(async (id: UUID) => unwrapServiceResponse(await usersService.unlockUser(id)));
}

export function useResetUserPasswordMutation() {
  return useUsersMutation(async ({ id, temporaryPassword }: { id: UUID; temporaryPassword: string }) =>
    unwrapServiceResponse(await usersService.resetPassword(id, temporaryPassword)));
}

export function useDeleteUserMutation() {
  return useUsersMutation(async (id: UUID) => unwrapServiceResponse(await usersService.deleteUser(id)));
}
