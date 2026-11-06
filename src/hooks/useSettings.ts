import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { SettingsRequest } from "@/api";
import { settingsService } from "@/services";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const SETTINGS_ENDPOINT = "/api/settings";

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.detail(),
    queryFn: async () => unwrapServiceResponse(await settingsService.getSettings()),
    refetchOnWindowFocus: true,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: (payload: SettingsRequest) => ({
      data: payload,
      method: "PUT",
      url: SETTINGS_ENDPOINT,
    }),
    mutationFn: async (payload: SettingsRequest) => unwrapServiceResponse(await settingsService.updateSettings(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}