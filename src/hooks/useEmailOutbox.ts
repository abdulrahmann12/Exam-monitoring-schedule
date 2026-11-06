import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UUID } from "@/api";
import { emailOutboxService } from "@/api";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

/** Refreshes every 5 seconds while emails are still on their way. */
export function useEmailCountsQuery() {
  return useQuery({
    queryKey: queryKeys.emails.counts,
    queryFn: async () => unwrapServiceResponse(await emailOutboxService.getCounts()),
    refetchInterval: (query) => {
      const counts = query.state.data?.counts;
      return counts && ((counts.QUEUED ?? 0) > 0 || (counts.SENDING ?? 0) > 0) ? 5000 : false;
    },
  });
}

export function useEmailLogQuery(page: number, status: string | undefined, live: boolean) {
  return useQuery({
    queryKey: queryKeys.emails.log(page, status),
    queryFn: async () => unwrapServiceResponse(await emailOutboxService.getLog(page, 50, status)),
    refetchInterval: live ? 5000 : false,
  });
}

function useEmailMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.emails.all });
    },
  });
}

export function useRetryEmailMutation() {
  return useEmailMutation(async (id: UUID) => unwrapServiceResponse(await emailOutboxService.retry(id)));
}

export function useRetryAllFailedEmailsMutation() {
  return useEmailMutation<void, { queued: number }>(async () => unwrapServiceResponse(await emailOutboxService.retryAllFailed()));
}
