import { FlaskConical, LoaderCircle, MailCheck } from "lucide-react";
import { useState } from "react";

import type { EmailChangeStarted } from "@/api/services/authService";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";
import { getErrorMessage } from "@/utils/error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Changes the sign-in email. The new address gets a confirmation link; the email only changes when
 * it is opened, so a typo (or someone else's address) can never take over the account.
 */
export function ChangeEmailDialog({ currentEmail, onClose }: { currentEmail: string; onClose: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<EmailChangeStarted | null>(null);

  const trimmed = newEmail.trim();
  const sameAsNow = trimmed.toLowerCase() === currentEmail.toLowerCase();
  const canSubmit = EMAIL_PATTERN.test(trimmed) && !sameAsNow && password.length > 0 && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      setStarted(unwrapServiceResponse(await authService.requestEmailChange({ newEmail: trimmed, currentPassword: password })));
      setPassword("");
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {started ? (
          <>
            <DialogHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MailCheck className="h-5 w-5" /></div>
              <DialogTitle>Check your new inbox</DialogTitle>
              <DialogDescription>
                {started.emailSent
                  ? <>We sent a confirmation link to <span className="font-medium text-foreground">{started.newEmail}</span>. Your email changes only when you open it (within 24 hours). Until then, keep signing in with {currentEmail}.</>
                  : <>Your email changes only when the confirmation link for <span className="font-medium text-foreground">{started.newEmail}</span> is opened (within 24 hours).</>}
              </DialogDescription>
            </DialogHeader>
            {started.devLink && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-warning"><FlaskConical className="h-4 w-4" /> Local test mode</p>
                <p className="mt-1 text-muted-foreground">Email is not set up on this computer, so here is the link that would have been emailed. This never appears on the live site.</p>
                <a href={started.devLink} className="mt-2 inline-block font-medium text-primary hover:underline">Open confirmation link</a>
              </div>
            )}
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change sign-in email</DialogTitle>
              <DialogDescription>
                Now: <span className="font-medium text-foreground">{currentEmail}</span>. We will email a link to the new address to make sure it is yours.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
              {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="new-email">New email</Label>
                <Input id="new-email" type="email" autoComplete="email" value={newEmail} maxLength={160} onChange={(event) => { setNewEmail(event.target.value); setError(null); }} autoFocus />
                {sameAsNow && trimmed && <p className="text-xs text-muted-foreground">This is already your email.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-change-password">Current password</Label>
                <Input id="email-change-password" type="password" autoComplete="current-password" value={password} maxLength={128} onChange={(event) => { setPassword(event.target.value); setError(null); }} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="gap-2" disabled={!canSubmit}>
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {saving ? "Sending..." : "Send confirmation link"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
