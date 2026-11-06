import { useQueryClient } from "@tanstack/react-query";
import type { ImportDateOrder } from "@/api";

import type { ScheduleBulkUploadRowError, UUID } from "@/api";
import { scheduleGroupsService } from "@/services";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

import { queryKeys } from "./queryKeys";
import { useSafeMutation } from "./useSafeRequest";

const SCHEDULE_GROUPS_ENDPOINT = "/api/schedule-groups";

// -- Template download --------------------------------------------------------

/**
 * Imperatively downloads the schedule bulk-upload Excel template for the
 * given schedule-group.  Not a hook – called directly from the modal button.
 */
export async function downloadScheduleBulkTemplate(groupId: UUID) {
  return unwrapServiceResponse(
    await scheduleGroupsService.downloadBulkTemplate(groupId),
  );
}

// -- Row-error extraction ------------------------------------------------------

/**
 * Extracts the typed row-level errors from a 400 ApiError.
 *
 * The backend `GlobalExceptionHandler` maps `BulkRowValidationException` rows into
 * `validationErrors` on the standard `ApiErrorResponse`:
 *   `{ validationErrors: [{ field: "Row 2", message: "Date is required." }] }`
 *
 * The frontend `normalizeApiError` copies these onto `ApiError.validationErrors`
 * as `ValidationError[]` with `{ field: string; message: string }`.
 *
 * We parse the row number from the `field` string (e.g. "Row 2" → 2).
 */
export function extractBulkUploadRowErrors(error: unknown): ScheduleBulkUploadRowError[] {
  if (!(error instanceof Error)) return [];

  try {
    // ApiError stores validationErrors directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validationErrors = (error as any).validationErrors as
      | Array<{ field: string; message: string }>
      | undefined;

    if (!Array.isArray(validationErrors) || validationErrors.length === 0) {
      return [];
    }

    const ROW_PREFIX = /^Row\s+(\d+)$/i;
    const results: ScheduleBulkUploadRowError[] = [];

    for (const ve of validationErrors) {
      const match = ROW_PREFIX.exec(ve.field);
      if (match) {
        results.push({ row: parseInt(match[1], 10), message: ve.message });
      }
    }

    return results;
  } catch {
    // silently ignore unexpected shapes
  }
  return [];
}



// -- Upload mutation -----------------------------------------------------------

interface UploadBulkScheduleVariables {
  groupId: UUID;
  file: File;
  dateOrder?: ImportDateOrder;
}

/**
 * TanStack Query mutation for `POST /api/schedule-groups/{id}/bulk-upload`.
 *
 * On success it invalidates:
 *  - `assignments` – so the Scheduler grid re-fetches the newly generated rows
 *  - `schedule-groups` – updates assignmentCount in the selector
 */
export function useBulkScheduleUploadMutation() {
  const queryClient = useQueryClient();

  return useSafeMutation({
    getFingerprint: ({ groupId }: UploadBulkScheduleVariables) => ({
      method: "POST",
      resourceId: groupId,
      url: `${SCHEDULE_GROUPS_ENDPOINT}/${groupId}/bulk-upload`,
    }),
    mutationFn: async ({ groupId, file, dateOrder }: UploadBulkScheduleVariables) =>
      unwrapServiceResponse(
        await scheduleGroupsService.uploadBulkSchedule(groupId, file, dateOrder),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleGroups.all });
    },
  });
}
