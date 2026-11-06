import {
  Building2, CircleCheck, CirclePause, Copy, LogOut, MailCheck, MailWarning, Moon, PencilLine, Plus, ShieldCheck, Sun, UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminInvitation, OwnerUniversity } from "@/api";
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
import { ChangePasswordCard } from "@/components/uniguard/ChangePasswordCard";
import {
  useAddUniversityAdminMutation,
  useCreateUniversityMutation,
  useOwnerActivityQuery,
  useOwnerOverviewQuery,
  useUpdateUniversityMutation,
} from "@/hooks";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { slugFromName } from "@/lib/owner/slug";
import { useAuth } from "@/state/auth";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function OwnerPanel() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useBranding();
  const overviewQuery = useOwnerOverviewQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OwnerUniversity | null>(null);
  const [toggling, setToggling] = useState<OwnerUniversity | null>(null);
  const [addingAdminTo, setAddingAdminTo] = useState<OwnerUniversity | null>(null);
  const [invitation, setInvitation] = useState<AdminInvitation | null>(null);

  const overview = overviewQuery.data;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Uni-Guard Schedules · Owner panel</div>
              <div className="text-xs text-muted-foreground">{user?.email} · Platform owner</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Universities</h1>
            <p className="text-sm text-muted-foreground">
              Create universities, invite their administrators and switch access off or on. You see usage counts only, never a university's data.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New university
          </Button>
        </div>

        {overviewQuery.isLoading ? (
          <LoadingState title="Loading universities..." />
        ) : overviewQuery.isError || !overview ? (
          <ErrorState description={getErrorMessage(overviewQuery.error)} onRetry={() => void overviewQuery.refetch()} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
              <Stat label="Universities" value={overview.totals.universities} hint={`${overview.totals.activeUniversities} active`} />
              <Stat label="User accounts" value={overview.totals.accounts} />
              <Stat label="Staff (people)" value={overview.totals.people} />
              <Stat label="Scheduled exam rooms" value={overview.totals.scheduledExamRooms} />
            </section>

            {overview.universities.length === 0 ? (
              <EmptyState title="No universities yet" description="Create the first one with “New university”." />
            ) : (
              <section className="space-y-3">
                {overview.universities.map((university) => (
                  <UniversityCard
                    key={university.id}
                    university={university}
                    onEdit={() => setEditing(university)}
                    onToggle={() => setToggling(university)}
                    onAddAdmin={() => setAddingAdminTo(university)}
                  />
                ))}
              </section>
            )}
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PlatformActivity />
          <ChangePasswordCard showSignOutEverywhere />
        </div>
      </main>

      {creating && <CreateUniversityDialog onClose={() => setCreating(false)} onCreated={(result) => { setCreating(false); setInvitation(result); }} />}
      {editing && <RenameDialog university={editing} onClose={() => setEditing(null)} />}
      {toggling && <ToggleDialog university={toggling} onClose={() => setToggling(null)} />}
      {addingAdminTo && (
        <AddAdminDialog
          university={addingAdminTo}
          onClose={() => setAddingAdminTo(null)}
          onInvited={(result) => { setAddingAdminTo(null); setInvitation(result); }}
        />
      )}
      {invitation && <InvitationDialog result={invitation} onClose={() => setInvitation(null)} />}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function UniversityCard({ university, onEdit, onToggle, onAddAdmin }: {
  university: OwnerUniversity;
  onEdit: () => void;
  onToggle: () => void;
  onAddAdmin: () => void;
}) {
  return (
    <article className={`rounded-xl border bg-card p-4 shadow-card ${university.active ? "border-border" : "border-warning/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-semibold">{university.name}</h2>
              {university.active
                ? <Badge variant="secondary" className="gap-1"><CircleCheck className="h-3 w-3" /> Active</Badge>
                : <Badge variant="outline" className="gap-1 border-warning/50 text-warning"><CirclePause className="h-3 w-3" /> Switched off</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              {university.slug} · created {new Date(university.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={onAddAdmin}><UserPlus className="h-4 w-4" /> Add admin</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={onEdit}><PencilLine className="h-4 w-4" /> Rename</Button>
          <Button variant={university.active ? "outline" : "default"} size="sm" onClick={onToggle}>
            {university.active ? "Switch off" : "Switch on"}
          </Button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Usage label="Accounts" value={university.accounts} />
        <Usage label="Staff" value={university.people} />
        <Usage label="Rooms" value={university.rooms} />
        <Usage label="Scheduled exam rooms" value={university.scheduledExamRooms} />
        <Usage label="Last sign-in" value={when(university.lastSignInAt)} />
        <Usage label="Last activity" value={when(university.lastActivityAt)} />
      </dl>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Administrators</div>
        {university.admins.length === 0 ? (
          <p className="text-sm text-warning">No administrator. Use “Add admin” so someone can manage this university.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {university.admins.map((admin) => (
              <li key={admin.id} className="rounded-md border border-border px-2 py-1 text-xs">
                {admin.displayName ? `${admin.displayName} · ` : ""}{admin.email}
                {admin.signedIn ? null : admin.invitationPending
                  ? <span className="ml-1 text-muted-foreground">(invitation sent)</span>
                  : <span className="ml-1 text-warning">(not signed in yet)</span>}
                {!admin.enabled && <span className="ml-1 text-destructive">(disabled)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function Usage({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</dd>
    </div>
  );
}

function CreateUniversityDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (result: AdminInvitation) => void }) {
  const mutation = useCreateUniversityMutation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");

  const effectiveSlug = slugEdited ? slug : slugFromName(name);
  const slugInvalid = effectiveSlug.length > 0 && !SLUG_PATTERN.test(effectiveSlug);
  const emailInvalid = adminEmail.length > 0 && !EMAIL_PATTERN.test(adminEmail.trim());
  const canSubmit = name.trim().length > 0 && SLUG_PATTERN.test(effectiveSlug) && EMAIL_PATTERN.test(adminEmail.trim()) && !mutation.isPending;

  async function submit() {
    try {
      const result = await mutation.mutateAsync({
        name: name.trim(),
        slug: effectiveSlug,
        adminEmail: adminEmail.trim(),
        adminName: adminName.trim() || undefined,
      });
      toast.success(`University “${result.university.name}” created.`);
      onCreated(result);
    } catch (error) {
      showErrorToast(error, { title: "Could not create the university." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New university</DialogTitle>
          <DialogDescription>
            It starts empty with its own settings. Its first administrator gets a link to choose a password, then sets everything else up.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1">
            <Label htmlFor="uni-name">University name</Label>
            <Input id="uni-name" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="uni-slug">Short code</Label>
            <Input
              id="uni-slug"
              value={effectiveSlug}
              maxLength={60}
              onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }}
            />
            <p className={`text-xs ${slugInvalid ? "text-destructive" : "text-muted-foreground"}`}>
              Lowercase letters, digits and dashes, 3 to 60 characters. Must be unique.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="uni-admin-email">First administrator's email</Label>
            <Input id="uni-admin-email" type="email" value={adminEmail} maxLength={160} onChange={(event) => setAdminEmail(event.target.value)} />
            {emailInvalid && <p className="text-xs text-destructive">Enter a valid email address.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="uni-admin-name">Administrator's name (optional)</Label>
            <Input id="uni-admin-name" value={adminName} maxLength={120} onChange={(event) => setAdminName(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>{mutation.isPending ? "Creating..." : "Create and invite"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ university, onClose }: { university: OwnerUniversity; onClose: () => void }) {
  const mutation = useUpdateUniversityMutation();
  const [name, setName] = useState(university.name);
  const canSubmit = name.trim().length > 0 && name.trim() !== university.name && !mutation.isPending;

  async function submit() {
    try {
      await mutation.mutateAsync({ id: university.id, payload: { name: name.trim(), active: university.active } });
      toast.success("University renamed.");
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not rename the university." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename university</DialogTitle>
          <DialogDescription>The new name appears in its users' header. Its short code stays the same.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1">
            <Label htmlFor="rename-uni">University name</Label>
            <Input id="rename-uni" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>{mutation.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleDialog({ university, onClose }: { university: OwnerUniversity; onClose: () => void }) {
  const mutation = useUpdateUniversityMutation();
  const switchingOff = university.active;

  async function confirm() {
    try {
      await mutation.mutateAsync({ id: university.id, payload: { name: university.name, active: !university.active } });
      toast.success(switchingOff ? `“${university.name}” is switched off.` : `“${university.name}” is switched on.`);
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not change the university." });
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{switchingOff ? `Switch off “${university.name}”?` : `Switch on “${university.name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {switchingOff
              ? `All ${university.accounts} account(s) of this university are signed out now and cannot sign in until you switch it on again. Its data is kept. Other universities are not affected.`
              : "Its users can sign in again with their existing passwords."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={switchingOff ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            disabled={mutation.isPending}
            onClick={(event) => { event.preventDefault(); void confirm(); }}
          >
            {switchingOff ? "Switch off" : "Switch on"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddAdminDialog({ university, onClose, onInvited }: {
  university: OwnerUniversity;
  onClose: () => void;
  onInvited: (result: AdminInvitation) => void;
}) {
  const mutation = useAddUniversityAdminMutation();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const pending = university.admins.filter((admin) => !admin.signedIn);
  const canSubmit = EMAIL_PATTERN.test(email.trim()) && !mutation.isPending;

  async function submit() {
    try {
      const result = await mutation.mutateAsync({ id: university.id, payload: { email: email.trim(), displayName: displayName.trim() || undefined } });
      onInvited(result);
    } catch (error) {
      showErrorToast(error, { title: "Could not invite the administrator." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Administrator for {university.name}</DialogTitle>
          <DialogDescription>
            Invite a new administrator, or enter the email of one who has not signed in yet to send them a fresh link (the old link stops working).
          </DialogDescription>
        </DialogHeader>
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Not signed in yet:</span>
            {pending.map((admin) => (
              <button key={admin.id} type="button" className="rounded border border-border px-2 py-0.5 hover:bg-muted" onClick={() => setEmail(admin.email)}>
                {admin.email}
              </button>
            ))}
          </div>
        )}
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-name">Name (optional, for new administrators)</Label>
            <Input id="admin-name" value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>{mutation.isPending ? "Sending..." : "Send invitation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The one-time link, to share by hand when email is not set up (or as a backup). */
function InvitationDialog({ result, onClose }: { result: AdminInvitation; onClose: () => void }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      toast.success("Invitation link copied.");
    } catch {
      toast.error("Could not copy automatically. Select the link and copy it.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitation for {result.adminEmail}</DialogTitle>
          <DialogDescription>
            Administrator of {result.university.name}.{" "}
            {result.emailSent
              ? "The invitation email is on its way. You can also share the link below yourself."
              : "Email is not set up on the server, so no email was sent. Send this link to the person yourself."}
          </DialogDescription>
        </DialogHeader>
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${result.emailSent ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
          {result.emailSent ? <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
          <p>
            Works once, only for this person, until {new Date(result.inviteExpiresAt).toLocaleString()}.
            Anyone with the link can set this account's password, so share it only with them.
          </p>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={result.inviteLink} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} aria-label="Invitation link" />
          <Button type="button" variant="outline" className="gap-1" onClick={() => void copy()}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformActivity() {
  const query = useOwnerActivityQuery();
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-semibold">Owner activity</h2>
      <p className="mb-3 text-xs text-muted-foreground">Your own actions and sign-ins. Each university's activity log is visible only to its administrators.</p>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">{getErrorMessage(query.error)}</p>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {query.data?.items.map((event) => (
            <li key={event.id} className="border-b border-border pb-2 text-sm last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={event.outcome === "SUCCESS" ? "" : "text-destructive"}>{event.summary}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">{event.actorEmail ?? "unknown"}{event.ipAddress ? ` · ${event.ipAddress}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
