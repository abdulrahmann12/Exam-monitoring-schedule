import { CalendarRange, Mail, Plus } from "lucide-react";
import { confirmDiscardUnsaved } from "@/lib/unsavedChanges";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateScheduleGroupMutation, useNotifyScheduleGroupMutation } from "@/hooks/useScheduleGroups";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { showErrorToast } from "@/utils/error";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ScheduleGroupSelector({ className }: { className?: string } = {}) {
  const { groups, activeGroup, activeGroupId, isLoading, setActiveGroupId } = useScheduleGroup();
  const createMutation = useCreateScheduleGroupMutation();
  const notifyMutation = useNotifyScheduleGroupMutation();
  const isDemoUser = useDemoUser();
  const { canEdit, canViewEmails: canSeeEmails } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [resendAll, setResendAll] = useState(false);
  const navigate = useNavigate();
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
      const result = await notifyMutation.mutateAsync({ id: activeGroupId, resendAll });
      setNotifyOpen(false);
      setResendAll(false);

      if (result.queued === 0 && result.skipped === 0 && result.unchanged === 0) {
        toast.warning("No assigned staff to notify for this period.");
        return;
      }

      const parts: string[] = [];
      parts.push(result.queued > 0 ? `${result.queued} email(s) are being sent in the background` : "Nothing new to send");
      if (result.unchanged > 0) {
        parts.push(`${result.unchanged} already received this exact schedule`);
      }
      if (result.skipped > 0) {
        parts.push(`${result.skipped} without email`);
      }
      toast.success(`${parts.join(". ")}.`, {
        description: result.skippedNames.length > 0 ? `No email: ${result.skippedNames.join(", ")}` : undefined,
        action: canSeeEmails ? { label: "View emails", onClick: () => navigate("/emails") } : undefined,
      });
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <CalendarRange className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <Select
        value={activeGroupId ?? undefined}
        onValueChange={(id) => { if (confirmDiscardUnsaved()) setActiveGroupId(id); }}
        disabled={isLoading || groups.length === 0}
      >
        <SelectTrigger className="h-9 min-w-0 flex-1 bg-background/50 md:w-[200px] md:flex-none" aria-label="Schedule group">
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
        onClick={() => confirmDiscardUnsaved() && setCreateOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      {!isDemoUser && canEdit && (
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
              Emails are sent in the background and retried if the email service has trouble. People who already
              received this exact schedule are not emailed again; people without an email address are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={resendAll} onChange={(event) => setResendAll(event.target.checked)} />
            Send to everyone again, also if their schedule did not change
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifyMutation.isPending}>Cancel</AlertDialogCancel>
            <Button disabled={notifyMutation.isPending || !activeGroupId} onClick={() => void handleNotify()}>
              {notifyMutation.isPending ? "Preparing..." : "Send emails"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
