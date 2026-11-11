import { Check, Loader2, PencilLine, Plus, Shapes, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { RoomCategory } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useCreateRoomCategoryMutation,
  useDeleteRoomCategoryMutation,
  useRoomCategoriesQuery,
  useUpdateRoomCategoryMutation,
} from "@/hooks/useRoomCategories";
import { showErrorToast } from "@/utils/error";

/** Rooms page → "Room types": the university's own list (Classroom, Computer Lab, Drawing Studio, ...). */
export function RoomTypesDialog() {
  const [open, setOpen] = useState(false);
  const categoriesQuery = useRoomCategoriesQuery();
  const createMutation = useCreateRoomCategoryMutation();
  const [newName, setNewName] = useState("");
  const [newSpecial, setNewSpecial] = useState(true);
  const types = categoriesQuery.data ?? [];

  async function add() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ name, special: newSpecial });
      toast.success(`Room type “${name}” added.`);
      setNewName("");
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Shapes className="h-4 w-4" /> Room types</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Room types</DialogTitle>
          <DialogDescription>
            Your own list. <b>Special</b> types (labs, studios) are only given to exams that ask for exactly that type in the exam list;
            normal exams never get them.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {categoriesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {types.map((type) => <TypeRow key={type.id} type={type} />)}
        </div>

        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium">Add a room type</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={newName}
              maxLength={60}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void add()}
              placeholder="e.g. Language Lab"
              aria-label="New room type name"
            />
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <Switch checked={newSpecial} onCheckedChange={setNewSpecial} aria-label="New room type is special" /> Special
            </label>
            <Button className="shrink-0 gap-2" disabled={!newName.trim() || createMutation.isPending} onClick={() => void add()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypeRow({ type }: { type: RoomCategory }) {
  const updateMutation = useUpdateRoomCategoryMutation();
  const deleteMutation = useDeleteRoomCategoryMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);

  async function save(next: { name: string; special: boolean }) {
    try {
      await updateMutation.mutateAsync({ id: type.id, payload: next });
      setEditing(false);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function remove() {
    try {
      await deleteMutation.mutateAsync(type.id);
      toast.success(`Room type “${type.name}” deleted.`);
    } catch (error) {
      showErrorToast(error, { title: "Could not delete this room type." });
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={name}
              maxLength={60}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && name.trim() && void save({ name: name.trim(), special: type.special })}
              className="h-8"
              aria-label={`New name for ${type.name}`}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Save name" disabled={!name.trim()} onClick={() => void save({ name: name.trim(), special: type.special })}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancel" onClick={() => { setName(type.name); setEditing(false); }}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            <p className="truncate font-medium">{type.name}</p>
            <p className="text-xs text-muted-foreground">{type.rooms} room{type.rooms === 1 ? "" : "s"}</p>
          </>
        )}
      </div>
      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        Special
        <Switch checked={type.special} onCheckedChange={(special) => void save({ name: type.name, special })} aria-label={`${type.name} is special`} />
      </label>
      {!editing && (
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Rename ${type.name}`} onClick={() => setEditing(true)}><PencilLine className="h-4 w-4" /></Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        aria-label={`Delete ${type.name}`}
        disabled={type.rooms > 0 || deleteMutation.isPending}
        title={type.rooms > 0 ? "Rooms still have this type" : undefined}
        onClick={() => void remove()}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
