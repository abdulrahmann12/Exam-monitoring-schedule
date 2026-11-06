import { useQuery } from "@tanstack/react-query";

import type { UUID } from "@/api";
import { reportsService } from "@/api";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";

export function useWorkloadReportQuery(scheduleGroupId: UUID | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.workload(scheduleGroupId ?? ""),
    queryFn: async () => unwrapServiceResponse(await reportsService.getWorkload(scheduleGroupId as UUID)),
    enabled: Boolean(scheduleGroupId),
  });
}

export function useAnalyticsQuery(scheduleGroupId: UUID | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.analytics(scheduleGroupId ?? ""),
    queryFn: async () => unwrapServiceResponse(await reportsService.getAnalytics(scheduleGroupId as UUID)),
    enabled: Boolean(scheduleGroupId),
  });
}
