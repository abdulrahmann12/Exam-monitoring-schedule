import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";
import { showErrorToast } from "@/utils/error";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

const MIN_LENGTH = 10;

/** Lets the signed-in admin change their password. Other devices are signed out by the server. */
export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= MIN_LENGTH && newPassword === confirmPassword && !saving;

  const submit = async () => {
    try {
      setSaving(true);
      unwrapServiceResponse(await authService.changePassword({ currentPassword, newPassword }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed", { description: "You were signed out on every other device." });
    } catch (error) {
      showErrorToast(error, { title: "Could not change the password." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      <header>
        <h3 className="text-display text-lg font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Account security</h3>
        <p className="text-sm text-muted-foreground">Changing your password signs you out everywhere else.</p>
      </header>
      <div className="space-y-3">
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          {tooShort && <p className="mt-1 text-xs text-destructive">At least {MIN_LENGTH} characters.</p>}
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {mismatch && <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>}
        </div>
        <Button className="gap-2" disabled={!canSubmit} onClick={() => void submit()}>
          <KeyRound className="h-4 w-4" /> {saving ? "Changing..." : "Change password"}
        </Button>
      </div>
    </section>
  );
}
