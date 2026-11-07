import { Building2, Copy, MailCheck, MailWarning, ShieldOff, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminInvitation, OwnerUniversity, OwnerUniversityAdmin } from "@/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddUniversityAdminMutation,
  useCreateUniversityMutation,
  useResetAdminTwoFactorMutation,
  useUpdateUniversityMutation,
} from "@/hooks";
import { slugFromName } from "@/lib/owner/slug";
import { showErrorToast } from "@/utils/error";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function DialogIcon({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "destructive" | "warning" }) {
  const tones = { primary: "bg-primary/10 text-primary", destructive: "bg-destructive/10 text-destructive", warning: "bg-warning/10 text-warning" };
  return <div className={`mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{children}</div>;
}

export function CreateUniversityDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (result: AdminInvitation) => void }) {
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogIcon><Building2 className="h-5 w-5" /></DialogIcon>
          <DialogTitle>New university</DialogTitle>
          <DialogDescription>
            It starts empty with its own settings. Its first administrator gets a link to choose a password, then sets everything else up.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
            <div className="space-y-1.5">
              <Label htmlFor="uni-name">University name</Label>
              <Input id="uni-name" value={name} maxLength={160} placeholder="Cairo University" onChange={(event) => setName(event.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-slug">Short code</Label>
              <Input
                id="uni-slug"
                value={effectiveSlug}
                maxLength={60}
                placeholder="cairo-university"
                className="font-mono text-xs"
                aria-invalid={slugInvalid}
                onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }}
              />
            </div>
          </div>
          <p className={`-mt-2 text-xs ${slugInvalid ? "text-destructive" : "text-muted-foreground"}`}>
            Short code: lowercase letters, digits and dashes, 3 to 60 characters, unique.
          </p>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">First administrator</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="uni-admin-email">Email</Label>
                <Input id="uni-admin-email" type="email" value={adminEmail} maxLength={160} placeholder="admin@university.edu" aria-invalid={emailInvalid} onChange={(event) => setAdminEmail(event.target.value)} />
                {emailInvalid && <p className="text-xs text-destructive">Enter a valid email address.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uni-admin-name">Name (optional)</Label>
                <Input id="uni-admin-name" value={adminName} maxLength={120} onChange={(event) => setAdminName(event.target.value)} />
              </div>
            </div>
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

export function RenameDialog({ university, onClose }: { university: OwnerUniversity; onClose: () => void }) {
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
          <DialogDescription>The new name appears in its users' header. Its short code ({university.slug}) stays the same.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1.5">
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

export function ToggleDialog({ university, onClose }: { university: OwnerUniversity; onClose: () => void }) {
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

export function AddAdminDialog({ university, initialEmail = "", onClose, onInvited }: {
  university: OwnerUniversity;
  initialEmail?: string;
  onClose: () => void;
  onInvited: (result: AdminInvitation) => void;
}) {
  const mutation = useAddUniversityAdminMutation();
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState("");
  const pending = university.admins.filter((admin) => admin.enabled && !admin.signedIn);
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
          <DialogIcon><UserPlus className="h-5 w-5" /></DialogIcon>
          <DialogTitle>Administrator for {university.name}</DialogTitle>
          <DialogDescription>
            Invite a new administrator, or enter the email of one who has not signed in yet to send a fresh link (the old link stops working).
          </DialogDescription>
        </DialogHeader>
        {pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Resend to:</span>
            {pending.map((admin) => (
              <button key={admin.id} type="button" className="rounded-full border border-border px-2.5 py-0.5 transition-colors hover:bg-muted" onClick={() => setEmail(admin.email)}>
                {admin.email}
              </button>
            ))}
          </div>
        )}
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
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
export function InvitationDialog({ result, onClose }: { result: AdminInvitation; onClose: () => void }) {
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
          <DialogIcon tone={result.emailSent ? "primary" : "warning"}>
            {result.emailSent ? <MailCheck className="h-5 w-5" /> : <MailWarning className="h-5 w-5" />}
          </DialogIcon>
          <DialogTitle>Invitation for {result.adminEmail}</DialogTitle>
          <DialogDescription>
            Administrator of {result.university.name}.{" "}
            {result.emailSent
              ? "The invitation email is on its way. You can also share the link below yourself."
              : "Email is not set up on the server, so no email was sent. Send this link to the person yourself."}
          </DialogDescription>
        </DialogHeader>
        <p className={`rounded-lg border p-3 text-sm ${result.emailSent ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
          Works once, only for this person, until {new Date(result.inviteExpiresAt).toLocaleString()}.
          Anyone with the link can set this account's password, so share it only with them.
        </p>
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

/** The administrator lost their phone and recovery codes (for example the only administrator). */
export function ResetTwoFactorDialog({ university, admin, onClose }: { university: OwnerUniversity; admin: OwnerUniversityAdmin; onClose: () => void }) {
  const mutation = useResetAdminTwoFactorMutation();

  async function confirm() {
    try {
      await mutation.mutateAsync({ universityId: university.id, userId: admin.id });
      toast.success(`Two-step sign-in removed for ${admin.email}.`);
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not reset two-step sign-in." });
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <DialogIcon tone="destructive"><ShieldOff className="h-5 w-5" /></DialogIcon>
          <AlertDialogTitle>Reset two-step sign-in for {admin.email}?</AlertDialogTitle>
          <AlertDialogDescription>
            Only do this after confirming who is asking (for example by phone). They are signed out everywhere, can then sign in
            with their password only, and should set up two-step sign-in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(event) => { event.preventDefault(); void confirm(); }}
          >
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
