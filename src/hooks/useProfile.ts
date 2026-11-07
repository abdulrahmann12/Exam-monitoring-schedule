import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authService } from "@/api";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

/** Changes the signed-in person's own name, then reloads the session so the new name shows everywhere. */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => unwrapServiceResponse(await authService.updateProfile({ displayName })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
}
