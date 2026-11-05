import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { UUID } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemoUser } from "@/hooks/useDemoUser";
import { usePermissions } from "@/hooks/usePermissions";
import { peopleService } from "@/services";
import { showErrorToast } from "@/utils/error";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

/**
 * Date-specific leave for one person (conference, sickness, travel…).
 * The server blocks assignments on these dates and refuses leave that overlaps existing duties.
 */
export function UnavailabilityPanel({ personId }: { personId: UUID }) {
  const queryClient = useQueryClient();
  const isDemo = useDemoUser(); // demo sessions are read-only on the server
  const { canEdit } = usePermissions();
  const readOnly = isDemo || !canEdit;
  const queryKey = ["people", personId, "unavailability"] as const;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const leaveQuery = useQuery({
    queryKey,
    queryFn: async () => unwrapServiceResponse(await peopleService.getUnavailability(personId)),
  });

  const addMutation = useMutation({
    mutationFn: async () => unwrapServiceResponse(await peopleService.addUnavailability(personId, {
      startDate,
      endDate: endDate || startDate,
      reason: reason.trim() || null,
    })),
    onSuccess: async () => {
      setStartDate("");
      setEndDate("");
      setReason("");
      toast.success("Leave added");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => showErrorToast(error, { title: "Could not add leave." }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: UUID) => unwrapServiceResponse(await peopleService.deleteUnavailability(personId, id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => showErrorToast(error, { title: "Could not remove leave." }),
  });

  const periods = leaveQuery.data ?? [];
  const canAdd = Boolean(startDate) && (!endDate || endDate >= startDate) && !addMutation.isPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">
        <CalendarOff className="h-3 w-3" /> Leave / unavailable dates
      </div>

      {leaveQuery.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : periods.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No leave recorded.</div>
      ) : (
        <ul className="space-y-1">
          {periods.map((period) => (
            <li key={period.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs">
              <span className="font-mono">{period.startDate === period.endDate ? period.startDate : `${period.startDate} → ${period.endDate}`}</span>
              {period.reason && <span className="truncate text-muted-foreground">· {period.reason}</span>}
              {!readOnly && <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6"
                aria-label="Remove leave"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(period.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
        <Input type="date" aria-label="Leave start date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Input type="date" aria-label="Leave end date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
        <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button type="button" size="sm" className="gap-1" disabled={!canAdd} onClick={() => addMutation.mutate()}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>}
    </div>
  );
}
