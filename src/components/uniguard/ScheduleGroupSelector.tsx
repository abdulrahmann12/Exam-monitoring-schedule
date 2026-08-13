import { CalendarRange, Mail, Plus } from "lucide-react";
import { useState } from "react";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useCreateScheduleGroupMutation, useNotifyScheduleGroupMutation } from "@/hooks/useScheduleGroups";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { showErrorToast } from "@/utils/error";
import { toast } from "sonner";

export function ScheduleGroupSelector() {
  const { groups, activeGroup, activeGroupId, isLoading, setActiveGroupId } = useScheduleGroup();
  const createMutation = useCreateScheduleGroupMutation();
  const notifyMutation = useNotifyScheduleGroupMutation();
  const isDemoUser = useDemoUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        active: true,
      });
      setActiveGroupId(created.id);
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success(`Created ${created.name}. It starts empty.`);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function handleNotify() {
    if (!activeGroupId) {
      return;
    }

    try {
      const result = await notifyMutation.mutateAsync(activeGroupId);
      setNotifyOpen(false);

      if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
        toast.warning("No assigned staff to notify for this period.");
        return;
      }

      const parts = [`Sent ${result.sent}`];
      if (result.skipped > 0) {
        parts.push(`skipped ${result.skipped} without email`);
      }
      if (result.failed > 0) {
        parts.push(`failed ${result.failed}`);
      }
      const summary = `${parts.join(". ")}.`;

      if (result.failed > 0) {
        toast.error(summary, {
          description: result.failedNames.length > 0 ? result.failedNames.join(", ") : undefined,
        });
        return;
      }

      toast.success(summary, {
        description: result.skippedNames.length > 0 ? `No email: ${result.skippedNames.join(", ")}` : undefined,
      });
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <CalendarRange className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <Select
        value={activeGroupId ?? undefined}
        onValueChange={setActiveGroupId}
        disabled={isLoading || groups.length === 0}
      >
        <SelectTrigger className="h-9 w-[160px] bg-background/50 sm:w-[200px]" aria-label="Schedule group">
          <SelectValue placeholder={isLoading ? "Loading periods..." : "Select period"} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label="Create schedule group"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      {!isDemoUser && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Email schedules"
          disabled={!activeGroupId || notifyMutation.isPending}
          onClick={() => setNotifyOpen(true)}
        >
          <Mail className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New exam period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Fall 2026"
                autoFocus
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              People and rooms stay shared. Time slots and assignments for this period start empty.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createMutation.isPending || !name.trim()} onClick={() => void handleCreate()}>
              {createMutation.isPending ? "Creating..." : "Create period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send schedules for {activeGroup?.name ?? "this period"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Each assigned chief and invigilator receives a PDF of only their own rows for this exam period.
              People without an email address are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifyMutation.isPending}>Cancel</AlertDialogCancel>
            <Button disabled={notifyMutation.isPending || !activeGroupId} onClick={() => void handleNotify()}>
              {notifyMutation.isPending ? "Sending..." : "Send emails"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
