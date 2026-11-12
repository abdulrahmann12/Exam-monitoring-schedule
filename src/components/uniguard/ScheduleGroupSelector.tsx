import { CalendarRange, Check, ChevronDown, Mail, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ScheduleGroup } from "@/api";
import { useDemoUser } from "@/hooks/useDemoUser";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCreateScheduleGroupMutation,
  useDeleteScheduleGroupMutation,
  useNotifyScheduleGroupMutation,
  useUpdateScheduleGroupMutation,
} from "@/hooks/useScheduleGroups";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { showErrorToast } from "@/utils/error";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ScheduleGroupSelector({ className }: { className?: string } = {}) {
  const { groups, activeGroup, activeGroupId, isLoading, setActiveGroupId } = useScheduleGroup();
  const createMutation = useCreateScheduleGroupMutation();
  const notifyMutation = useNotifyScheduleGroupMutation();
  const updateMutation = useUpdateScheduleGroupMutation();
  const deleteMutation = useDeleteScheduleGroupMutation();
  const [listOpen, setListOpen] = useState(false);
  /** The period being renamed / deleted (null = dialog closed). */
  const [editing, setEditing] = useState<ScheduleGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleting, setDeleting] = useState<ScheduleGroup | null>(null);
  const [confirmName, setConfirmName] = useState("");
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

  function startEdit(group: ScheduleGroup) {
    setListOpen(false);
    setEditing(group);
    setEditName(group.name);
    setEditDescription(group.description ?? "");
  }

  async function handleRename() {
    if (!editing || !editName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: { name: editName.trim(), description: editDescription.trim() || null, active: editing.active },
      });
      toast.success(`Saved ${editName.trim()}.`);
      setEditing(null);
    } catch (error) {
      showErrorToast(error);
    }
  }

  function startDelete(group: ScheduleGroup) {
    setListOpen(false);
    // Deleting the open period throws away its unsaved changes on this page too.
    if (group.id === activeGroupId && !confirmDiscardUnsaved()) return;
    setDeleting(group);
    setConfirmName("");
  }

  /** With exam rooms in it, the name must be typed: deleting cannot be undone. */
  const deleteNeedsName = (deleting?.assignmentCount ?? 0) > 0;
  const deleteAllowed = !!deleting && (!deleteNeedsName || confirmName.trim() === deleting.name.trim());

  async function handleDelete() {
    if (!deleting || !deleteAllowed) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`Deleted ${deleting.name}.`);
      setDeleting(null);
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
      <Popover open={listOpen} onOpenChange={setListOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={listOpen}
            aria-label="Schedule group"
            disabled={isLoading || groups.length === 0}
            className="h-9 min-w-0 flex-1 justify-between bg-background/50 px-3 font-normal md:w-[200px] md:flex-none"
          >
            <span className="truncate">{activeGroup?.name ?? (isLoading ? "Loading periods..." : "Select period")}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,22rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search exam periods..." aria-label="Search exam periods" />
            <CommandList className="max-h-80">
              <CommandEmpty>No exam period matches your search.</CommandEmpty>
              <CommandGroup>
                {groups.map((group) => (
                  <CommandItem
                    key={group.id}
                    value={`${group.name} ${group.id}`}
                    onSelect={() => {
                      setListOpen(false);
                      if (group.id !== activeGroupId && confirmDiscardUnsaved()) setActiveGroupId(group.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check className={cn("h-4 w-4 shrink-0", group.id === activeGroupId ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{group.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {group.assignmentCount} exam room{group.assignmentCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    {!isDemoUser && canEdit && (
                      <span className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Rename ${group.name}`}
                          title="Rename"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); startEdit(group); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                          aria-label={`Delete ${group.name}`}
                          title={groups.length <= 1 ? "The last exam period cannot be deleted" : "Delete"}
                          disabled={groups.length <= 1}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); startDelete(group); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename exam period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="period-name">Name</Label>
              <Input id="period-name" value={editName} maxLength={120} onChange={(event) => setEditName(event.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="period-description">Description</Label>
              <Input id="period-description" value={editDescription} maxLength={500} onChange={(event) => setEditDescription(event.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={updateMutation.isPending || !editName.trim()} onClick={() => void handleRename()}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteNeedsName
                ? `This deletes the period and its ${deleting?.assignmentCount} exam room${deleting?.assignmentCount === 1 ? "" : "s"} with all chiefs and invigilators on them, and its saved room allocations. It cannot be undone.`
                : "This period has no exam rooms. It cannot be undone."}{" "}
              People, rooms and time slots are shared and stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteNeedsName && (
            <div className="space-y-1.5">
              <Label htmlFor="period-confirm">Type <span className="font-semibold">{deleting?.name}</span> to confirm</Label>
              <Input id="period-confirm" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteMutation.isPending || !deleteAllowed} onClick={() => void handleDelete()}>
              {deleteMutation.isPending ? "Deleting..." : "Delete period"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
