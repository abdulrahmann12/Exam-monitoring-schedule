import { PencilLine, Plus, Trash2, UserCog, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { Person, PersonRequest, PersonRole, WeekDay } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { BulkUploadCard } from "@/components/uniguard/BulkUploadCard";
import { DayBadges } from "@/components/uniguard/DayBadges";
import {
    useCreatePersonMutation,
    useDeletePersonMutation,
    useDownloadPeopleTemplateMutation,
    usePeopleQuery,
    useUpdatePersonMutation,
    useUploadPeopleBulkMutation,
} from "@/hooks";
import { roleLabel } from "@/lib/uniguard/types";
import { cn } from "@/lib/utils";
import { getErrorMessage, showErrorToast } from "@/utils/error";
import { toast } from "sonner";

const DEFAULT_AVAILABLE_DAYS: WeekDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu"];

export default function People() {
  const peopleQuery = usePeopleQuery();
  const createMutation = useCreatePersonMutation();
  const updateMutation = useUpdatePersonMutation();
  const deleteMutation = useDeletePersonMutation();
  const uploadBulkMutation = useUploadPeopleBulkMutation();
  const downloadTemplateMutation = useDownloadPeopleTemplateMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  if (peopleQuery.isLoading) {
    return (
      <AppLayout title="People" subtitle="Manage Chief Invigilators and Invigilators directly from backend data.">
        <LoadingState title="Loading people..." description="Retrieving the people directory." />
      </AppLayout>
    );
  }

  if (peopleQuery.isError) {
    return (
      <AppLayout title="People" subtitle="Manage Chief Invigilators and Invigilators directly from backend data.">
        <ErrorState description={getErrorMessage(peopleQuery.error)} onRetry={() => void peopleQuery.refetch()} />
      </AppLayout>
    );
  }

  const people = peopleQuery.data?.items ?? [];
  const chiefs = people.filter((person) => person.role === "CHIEF_INVIGILATOR");
  const invigilators = people.filter((person) => person.role === "INVIGILATOR");

  async function handleSubmit(payload: PersonRequest) {
    try {
      if (editingPerson) {
        await updateMutation.mutateAsync({ id: editingPerson.id, payload });
        toast.success("Person updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Person created.");
      }

      setDialogOpen(false);
      setEditingPerson(null);
    } catch (error) {
      showErrorToast(error);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Person deleted.");
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <AppLayout
      title="People"
      subtitle="Manage Chief Invigilators and Invigilators. Workload counts only the selected exam period."
      actions={
        <PersonDialog
          key={editingPerson?.id ?? "new-person"}
          open={dialogOpen}
          title={editingPerson ? "Edit person" : "Add person"}
          initialValue={editingPerson}
          trigger={
            <Button
              className="gap-2"
              onClick={() => {
                setEditingPerson(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add person
            </Button>
          }
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) {
              setEditingPerson(null);
            }
          }}
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      }
    >
      <div className="space-y-6">
        <BulkUploadCard
          kind="persons"
          existingNames={people.map((person) => person.name)}
          isUploading={uploadBulkMutation.isPending}
          onDownloadTemplate={() => downloadTemplateMutation.mutateAsync()}
          onUpload={({ file, duplicateStrategy }) => uploadBulkMutation.mutateAsync({ file, duplicateStrategy })}
        />

      <Tabs defaultValue="chiefs" className="space-y-5">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="chiefs" className="gap-2">
              <UserCog className="h-4 w-4" /> Chief Invigilators
              <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-chief-soft text-chief">{chiefs.length}</span>
            </TabsTrigger>
            <TabsTrigger value="invigilators" className="gap-2">
              <Users className="h-4 w-4" /> Invigilators
              <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-invigilator-soft text-invigilator">{invigilators.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chiefs">
          {chiefs.length === 0 ? (
            <EmptyState
              title="No chief invigilators"
              description="Create the first chief invigilator to start assigning rooms."
              action={<Button onClick={() => setDialogOpen(true)}>Create chief invigilator</Button>}
            />
          ) : (
            <StaffTable people={chiefs} tone="chief" onEdit={(person) => { setEditingPerson(person); setDialogOpen(true); }} onRemove={handleDelete} />
          )}
        </TabsContent>

        <TabsContent value="invigilators">
          {invigilators.length === 0 ? (
            <EmptyState
              title="No invigilators"
              description="Create invigilators to fill room assignments."
              action={<Button onClick={() => setDialogOpen(true)}>Create invigilator</Button>}
            />
          ) : (
            <StaffTable people={invigilators} tone="invigilator" onEdit={(person) => { setEditingPerson(person); setDialogOpen(true); }} onRemove={handleDelete} />
          )}
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}

function StaffTable({
  people,
  onEdit,
  onRemove,
  tone,
}: {
  people: Person[];
  onEdit: (person: Person) => void;
  onRemove: (id: string) => Promise<void>;
  tone: "chief" | "invigilator";
}) {
  const max = Math.max(1, ...people.map((person) => person.totalAssignments));
  const averageAssignments = people.reduce((sum, person) => sum + person.totalAssignments, 0) / Math.max(1, people.length);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="text-left">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-3 py-3 font-medium">Department</th>
            <th className="px-3 py-3 font-medium">Available days</th>
            <th className="px-3 py-3 font-medium">Workload</th>
            <th className="px-3 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-t border-border hover:bg-accent/20 transition-smooth">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-full grid place-items-center text-xs font-semibold", tone === "chief" ? "bg-chief-soft text-chief" : "bg-invigilator-soft text-invigilator")}>
                    {person.name.replace(/^Dr\.\s*/, "").split(" ").map((segment) => segment[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="font-medium">{person.name}</div>
                    <div className="text-[11px] text-muted-foreground">{person.email || "No email"}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{person.department}</td>
              <td className="px-3 py-3">
                <DayBadges value={person.availableDays} readOnly size="sm" />
              </td>
              <td className="px-3 py-3 w-48">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", tone === "chief" ? "bg-chief" : "bg-invigilator")}
                      style={{ width: `${(person.totalAssignments / max) * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums w-20 text-right", person.totalAssignments > Math.max(2, Math.ceil(averageAssignments * 1.5)) && "text-warning")}>
                    {person.totalAssignments}x assigned
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => onEdit(person)}>
                    <PencilLine className="h-4 w-4" /> Edit
                  </Button>
                  <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => void onRemove(person.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonDialog({
  open,
  title,
  initialValue,
  trigger,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  title: string;
  initialValue: Person | null;
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PersonRequest) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [formState, setFormState] = useState<PersonRequest>({
    name: "",
    department: "",
    email: "",
    role: "CHIEF_INVIGILATOR",
    availableDays: DEFAULT_AVAILABLE_DAYS,
  });

  useEffect(() => {
    setFormState(
      initialValue
        ? {
            name: initialValue.name,
            department: initialValue.department,
            email: initialValue.email ?? "",
            role: initialValue.role,
            availableDays: initialValue.availableDays,
          }
        : {
            name: "",
            department: "",
            email: "",
            role: "CHIEF_INVIGILATOR",
            availableDays: DEFAULT_AVAILABLE_DAYS,
          },
    );
  }, [initialValue, open]);

  const trimmedEmail = formState.email?.trim() ?? "";
  const emailValid = trimmedEmail === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormState((previous) => ({ ...previous, role: "CHIEF_INVIGILATOR" }))}
              className={cn("rounded-lg border p-3 text-left transition-smooth", formState.role === "CHIEF_INVIGILATOR" ? "border-chief bg-chief-soft" : "border-border")}
            >
              <UserCog className="h-4 w-4 text-chief mb-1" />
              <div className="text-sm font-semibold">Chief Invigilator</div>
              <div className="text-[11px] text-muted-foreground">Supervises up to 2 rooms in one slot.</div>
            </button>
            <button
              onClick={() => setFormState((previous) => ({ ...previous, role: "INVIGILATOR" }))}
              className={cn("rounded-lg border p-3 text-left transition-smooth", formState.role === "INVIGILATOR" ? "border-invigilator bg-invigilator-soft" : "border-border")}
            >
              <Users className="h-4 w-4 text-invigilator mb-1" />
              <div className="text-sm font-semibold">Invigilator</div>
              <div className="text-[11px] text-muted-foreground">Assigned to 1 room per slot.</div>
            </button>
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={formState.name} onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))} placeholder={formState.role === "CHIEF_INVIGILATOR" ? "Dr. ..." : "Full name"} />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={formState.department} onChange={(event) => setFormState((previous) => ({ ...previous, department: event.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formState.email ?? ""}
              onChange={(event) => setFormState((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="Optional — used to send this person's schedule"
            />
            {!emailValid && <p className="mt-1 text-xs text-destructive">Enter a valid email, or leave this blank.</p>}
          </div>
          <div>
            <Label className="mb-2 block">Available days</Label>
            <DayBadges value={formState.availableDays} onChange={(nextDays) => setFormState((previous) => ({ ...previous, availableDays: nextDays as WeekDay[] }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={isSubmitting || !formState.name.trim() || !formState.department.trim() || !emailValid}
            onClick={() => void onSubmit({
              ...formState,
              name: formState.name.trim(),
              department: formState.department.trim(),
              email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
            })}
          >
            {isSubmitting ? "Saving..." : `Save ${roleLabel(formState.role as PersonRole)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
