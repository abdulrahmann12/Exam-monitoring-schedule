import { Copy, Download, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { TwoFactorSetup } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDisableTwoFactorMutation,
  useEnableTwoFactorMutation,
  useNewRecoveryCodesMutation,
  useStartTwoFactorSetupMutation,
  useTwoFactorStatusQuery,
} from "@/hooks/useTwoFactor";
import { showErrorToast } from "@/utils/error";

/** Two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, ...). */
export function TwoFactorCard() {
  const statusQuery = useTwoFactorStatusQuery();
  const [settingUp, setSettingUp] = useState(false);
  const [action, setAction] = useState<"disable" | "codes" | null>(null);
  const [shownCodes, setShownCodes] = useState<string[] | null>(null);
  const status = statusQuery.data;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-display flex items-center gap-2 text-lg font-semibold"><Smartphone className="h-4 w-4" /> Two-step sign-in</h3>
          <p className="text-sm text-muted-foreground">
            After your password, enter a 6-digit code from an authenticator app on your phone, such as Google Authenticator.
            A stolen password alone is then not enough to sign in.
          </p>
        </div>
        {status?.enabled
          ? <Badge variant="outline" className="gap-1 border-success/30 text-success"><ShieldCheck className="h-3 w-3" /> On</Badge>
          : <Badge variant="outline" className="gap-1"><ShieldOff className="h-3 w-3" /> Off</Badge>}
      </header>

      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !status ? (
        <p className="text-sm text-destructive">Could not load the two-step sign-in status.</p>
      ) : !status.available && !status.enabled ? (
        <p className="text-sm text-muted-foreground">Not available on this server yet. Ask the administrator of the platform to set it up.</p>
      ) : status.enabled ? (
        <div className="space-y-3">
          <p className="text-sm">
            On since {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : "—"}.{" "}
            <span className={status.recoveryCodesLeft <= 3 ? "font-medium text-warning" : "text-muted-foreground"}>
              {status.recoveryCodesLeft} recovery code(s) left{status.recoveryCodesLeft <= 3 ? ": create new ones soon." : "."}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAction("codes")}>New recovery codes</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setAction("disable")}>Switch off</Button>
          </div>
        </div>
      ) : (
        <Button className="gap-2" onClick={() => setSettingUp(true)}><ShieldCheck className="h-4 w-4" /> Set up two-step sign-in</Button>
      )}

      {settingUp && <SetupDialog onClose={() => setSettingUp(false)} onDone={(codes) => { setSettingUp(false); setShownCodes(codes); }} />}
      {action && (
        <PasswordAndCodeDialog
          mode={action}
          onClose={() => setAction(null)}
          onCodes={(codes) => { setAction(null); setShownCodes(codes); }}
        />
      )}
      {shownCodes && <RecoveryCodesDialog codes={shownCodes} onClose={() => setShownCodes(null)} />}
    </section>
  );
}

function SetupDialog({ onClose, onDone }: { onClose: () => void; onDone: (codes: string[]) => void }) {
  const startMutation = useStartTwoFactorSetupMutation();
  const enableMutation = useEnableTwoFactorMutation();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!setup) {
      return;
    }
    let cancelled = false;
    // Drawn in the browser: the secret never goes to any other service.
    QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 200, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [setup]);

  async function start() {
    try {
      setSetup(await startMutation.mutateAsync(password));
      setPassword("");
    } catch (error) {
      showErrorToast(error, { title: "Could not start the set-up." });
    }
  }

  async function confirm() {
    try {
      const result = await enableMutation.mutateAsync(code.replace(/\s/g, ""));
      toast.success("Two-step sign-in is on. Your other devices were signed out.");
      onDone(result.codes);
    } catch (error) {
      showErrorToast(error, { title: "Could not switch on two-step sign-in." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up two-step sign-in</DialogTitle>
          <DialogDescription>
            {setup ? "Scan the code with your authenticator app, then enter the 6-digit code it shows." : "First confirm it is you."}
          </DialogDescription>
        </DialogHeader>
        {!setup ? (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (password) void start(); }}>
            <div className="space-y-1">
              <Label htmlFor="mfa-password">Current password</Label>
              <Input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!password || startMutation.isPending}>{startMutation.isPending ? "Checking..." : "Continue"}</Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (/^\d{6}$/.test(code.replace(/\s/g, ""))) void confirm(); }}>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Install Google Authenticator (or Microsoft Authenticator, Authy, 1Password) on your phone.</li>
              <li>In the app, add an account and scan this code.</li>
            </ol>
            <div className="flex justify-center">
              {qr ? <img src={qr} alt="QR code for your authenticator app" className="h-48 w-48 rounded-md border border-border bg-white p-1" />
                : <div className="grid h-48 w-48 place-items-center rounded-md border border-border text-xs text-muted-foreground">Preparing QR code...</div>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="mfa-secret">Can't scan? Type this key into the app</Label>
              <Input id="mfa-secret" readOnly value={setup.secret} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mfa-code">6-digit code from the app</Label>
              <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))} className="font-mono tracking-widest" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!/^\d{6}$/.test(code.replace(/\s/g, "")) || enableMutation.isPending}>
                {enableMutation.isPending ? "Checking..." : "Switch on"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasswordAndCodeDialog({ mode, onClose, onCodes }: {
  mode: "disable" | "codes";
  onClose: () => void;
  onCodes: (codes: string[]) => void;
}) {
  const disableMutation = useDisableTwoFactorMutation();
  const codesMutation = useNewRecoveryCodesMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const pending = disableMutation.isPending || codesMutation.isPending;
  const canSubmit = currentPassword.length > 0 && code.trim().length >= 6 && !pending;

  async function submit() {
    try {
      if (mode === "disable") {
        await disableMutation.mutateAsync({ currentPassword, code: code.trim() });
        toast.success("Two-step sign-in is off.");
        onClose();
      } else {
        const result = await codesMutation.mutateAsync({ currentPassword, code: code.trim() });
        onCodes(result.codes);
      }
    } catch (error) {
      showErrorToast(error, { title: mode === "disable" ? "Could not switch off two-step sign-in." : "Could not create new recovery codes." });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "disable" ? "Switch off two-step sign-in?" : "New recovery codes"}</DialogTitle>
          <DialogDescription>
            {mode === "disable"
              ? "Your account will be protected by the password only. Confirm with your password and a code."
              : "Your old recovery codes stop working. Confirm with your password and a code."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (canSubmit) void submit(); }}>
          <div className="space-y-1">
            <Label htmlFor="mfa-confirm-password">Current password</Label>
            <Input id="mfa-confirm-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mfa-confirm-code">Code from the app, or a recovery code</Label>
            <Input id="mfa-confirm-code" autoComplete="one-time-code" maxLength={16} value={code} onChange={(event) => setCode(event.target.value)} className="font-mono" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={mode === "disable" ? "destructive" : "default"} disabled={!canSubmit}>
              {pending ? "Checking..." : mode === "disable" ? "Switch off" : "Create new codes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shown once: the server keeps only fingerprints of these codes. */
export function RecoveryCodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Recovery codes copied.");
    } catch {
      toast.error("Could not copy automatically. Select the codes and copy them.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`Uni-Guard Schedules recovery codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "uniguard-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your recovery codes</DialogTitle>
          <DialogDescription>
            If you lose your phone, sign in with one of these codes instead of the 6-digit code. Each works once.
            They are shown only now: keep them somewhere safe, not on the same phone.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm">
          {codes.map((code) => <li key={code}>{code}</li>)}
        </ul>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="gap-1" onClick={() => void copy()}><Copy className="h-4 w-4" /> Copy</Button>
          <Button type="button" variant="outline" className="gap-1" onClick={download}><Download className="h-4 w-4" /> Download</Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I have saved them</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
