import { KeyRound, LockOpen, PencilLine, Plus, ShieldCheck, Trash2, UserCog, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AppUser, AssignableRole } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AppLayout } from "@/components/uniguard/AppLayout";
import {
  roleLabel,
  useCreateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useUnlockUserMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from "@/hooks";
import { useAuth } from "@/state/auth";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const MIN_PASSWORD = 10;
const MAX_PASSWORD_BYTES = 72;
const SUBTITLE = "Who can sign in, and what each person is allowed to do.";

const ROLES: Array<{ value: AssignableRole; description: string }> = [
  { value: "ADMIN", description: "Everything, including users and settings." },
  { value: "SCHEDULER", description: "Builds and edits schedules, people, rooms and time slots." },
  { value: "VIEWER", description: "Read-only: can view and export schedules." },
];

const ROLE_BADGES: Record<AssignableRole, string> = {
  ADMIN: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  SCHEDULER: "bg-success/10 text-success border-success/20 hover:bg-success/15",
  VIEWER: "bg-muted text-muted-foreground border-border hover:bg-muted",
};

/** Random temporary password without look-alike characters (0/O, 1/l/I). */
function generatePassword(length = 14): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `At least ${MIN_PASSWORD} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "Too long.";
  }
  return null;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function Users() {
  const { user: me } = useAuth();
  const usersQuery = useUsersQuery();
  const unlockMutation = useUnlockUserMutation();
  const deleteMutation = useDeleteUserMutation();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  const isSelf = (user: AppUser) => user.id === me?.id || user.email.toLowerCase() === me?.email.toLowerCase();

  const actions = (
    <Button className="gap-2" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" /> Add user
    </Button>
  );

  if (usersQuery.isLoading) {
    return (
      <AppLayout title="Users" subtitle={SUBTITLE}>
        <LoadingState title="Loading users..." description="Fetching accounts from the backend." />
      </AppLayout>
    );
  }

  if (usersQuery.isError) {
    return (
      <AppLayout title="Users" subtitle={SUBTITLE}>
        <ErrorState description={getErrorMessage(usersQuery.error)} onRetry={() => void usersQuery.refetch()} />
      </AppLayout>
    );
  }

  const users = usersQuery.data ?? [];

  async function unlock(user: AppUser) {
    try {
      await unlockMutation.mutateAsync(user.id);
      toast.success(`${user.email} can sign in again.`);
    } catch (error) {
      showErrorToast(error, { title: "Could not unlock the account." });
    }
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`${deleting.email} was deleted.`);
      setDeleting(null);
    } catch (error) {
      showErrorToast(error, { title: "Could not delete the user." });
    }
  }

  return (
    <AppLayout title="Users" subtitle={SUBTITLE} actions={actions}>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role.value} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <Badge variant="outline" className={ROLE_BADGES[role.value]}>{roleLabel(role.value)}</Badge>
            <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
          </div>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users yet" description="Add the people who should be able to sign in." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const self = isSelf(user);
                return (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.displayName || user.email}{self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div>
                      {user.displayName && <div className="text-xs text-muted-foreground">{user.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={ROLE_BADGES[user.role]}>{roleLabel(user.role)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.enabled
                          ? <Badge variant="outline" className="border-success/30 text-success">Active</Badge>
                          : <Badge variant="outline" className="border-destructive/30 text-destructive">Disabled</Badge>}
                        {user.locked && (
                          <Badge variant="outline" className="border-warning/30 text-warning" title={`Until ${formatDate(user.lockedUntil)}`}>Locked</Badge>
                        )}
                        {user.mustChangePassword && <Badge variant="outline">Temporary password</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {user.locked && (
                          <Button size="sm" variant="outline" className="gap-1" disabled={unlockMutation.isPending} onClick={() => void unlock(user)}>
                            <LockOpen className="h-3.5 w-3.5" /> Unlock
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label={`Edit ${user.email}`} onClick={() => setEditing(user)}>
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label={`Reset password of ${user.email}`} disabled={self}
                          title={self ? "Use Settings to change your own password" : "Set a new temporary password"}
                          onClick={() => setResetting(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label={`Delete ${user.email}`} disabled={self}
                          title={self ? "You cannot delete your own account" : "Delete user"}
                          onClick={() => setDeleting(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
      {editing && <EditUserDialog user={editing} isSelf={isSelf(editing)} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out and can no longer sign in. Schedules they made are kept. To block someone only for a while, disable the account instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function RoleSelect({ value, onChange, disabled }: { value: AssignableRole; onChange: (role: AssignableRole) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as AssignableRole)} disabled={disabled}>
      <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>{roleLabel(role.value)} — {role.description}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TemporaryPasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const problem = value.length > 0 ? passwordProblem(value) : null;
  return (
    <div>
      <Label htmlFor="temporary-password">Temporary password</Label>
      <div className="flex gap-2">
        <Input id="temporary-password" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" />
        <Button type="button" variant="outline" className="gap-1" onClick={() => onChange(generatePassword())}>
          <Wand2 className="h-4 w-4" /> Generate
        </Button>
      </div>
      {problem
        ? <p className="mt-1 text-xs text-destructive">{problem}</p>
        : <p className="mt-1 text-xs text-muted-foreground">Give it to the user privately. They must choose their own password when they first sign in.</p>}
    </div>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateUserMutation();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AssignableRole>("SCHEDULER");
  const [password, setPassword] = useState(() => generatePassword());

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && !passwordProblem(password) && !createMutation.isPending;

  async function submit() {
    try {
      await createMutation.mutateAsync({ email: email.trim(), displayName: displayName.trim() || null, role, temporaryPassword: password });
      toast.success(`${email.trim()} was added.`, { description: "Share the temporary password with them privately." });
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not add the user." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Add user</DialogTitle>
          <DialogDescription>The new user signs in with the temporary password and is asked to change it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
            {email.length > 0 && !emailValid && <p className="mt-1 text-xs text-destructive">Enter a valid email.</p>}
          </div>
          <div>
            <Label htmlFor="user-name">Name (optional)</Label>
            <Input id="user-name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="user-role">Role</Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          <TemporaryPasswordField value={password} onChange={setPassword} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>{createMutation.isPending ? "Adding..." : "Add user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, isSelf, onClose }: { user: AppUser; isSelf: boolean; onClose: () => void }) {
  const updateMutation = useUpdateUserMutation();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<AssignableRole>(user.role);
  const [enabled, setEnabled] = useState(user.enabled);

  async function submit() {
    try {
      await updateMutation.mutateAsync({ id: user.id, payload: { displayName: displayName.trim() || null, role, enabled } });
      toast.success(`${user.email} was updated.`);
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not update the user." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.email}</DialogTitle>
          {isSelf && (
            <DialogDescription className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> This is your account: you can rename yourself, but not change your own role or disable yourself.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-user-name">Name</Label>
            <Input id="edit-user-name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="user-role">Role</Label>
            <RoleSelect value={role} onChange={setRole} disabled={isSelf} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="user-enabled">Account enabled</Label>
              <p className="text-xs text-muted-foreground">Disabling signs the user out right away and blocks sign-in.</p>
            </div>
            <Switch id="user-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={isSelf} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={updateMutation.isPending} onClick={() => void submit()}>{updateMutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const resetMutation = useResetUserPasswordMutation();
  const [password, setPassword] = useState(() => generatePassword());

  async function submit() {
    try {
      await resetMutation.mutateAsync({ id: user.id, temporaryPassword: password });
      toast.success(`New temporary password set for ${user.email}.`, { description: "They were signed out everywhere." });
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not reset the password." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password of {user.email}</DialogTitle>
          <DialogDescription>The user is signed out on every device and must choose a new password at next sign-in. This also unlocks the account.</DialogDescription>
        </DialogHeader>
        <TemporaryPasswordField value={password} onChange={setPassword} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={Boolean(passwordProblem(password)) || resetMutation.isPending} onClick={() => void submit()}>
            {resetMutation.isPending ? "Saving..." : "Set temporary password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
