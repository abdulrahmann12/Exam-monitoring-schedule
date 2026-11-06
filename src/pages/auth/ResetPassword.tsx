import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import type { AccountLinkInfo } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";
import { getErrorMessage } from "@/utils/error";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

const MIN_LENGTH = 10;
const MAX_BYTES = 72;

/** Reads the secret from the address (after '#token=', which browsers never send to a server). */
function readTokenFromAddress(): string | null {
  const match = /(?:^#|&)token=([^&]+)/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}

type Stage = { kind: "checking" } | { kind: "invalid"; message: string } | { kind: "ready"; info: AccountLinkInfo } | { kind: "done" };

/** Sets a password from an invitation or a "forgot password" email link. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token] = useState(readTokenFromAddress); // pure: React may run this twice in development
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Remove the secret from the address bar so it does not stay in the browser history.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setStage({ kind: "invalid", message: "This link is incomplete. Open it again from the email, or ask for a new one." });
      return;
    }
    let cancelled = false;
    authService.checkPasswordLink(token).then((response) => {
      if (cancelled) {
        return;
      }
      setStage(response.success
        ? { kind: "ready", info: response.data }
        : { kind: "invalid", message: getErrorMessage(response.error) });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const tooLong = new TextEncoder().encode(password).length > MAX_BYTES;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN_LENGTH && !tooLong && password === confirm && !saving;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setSaving(true);
    try {
      unwrapServiceResponse(await authService.setPasswordFromLink(token, password));
      // The server ended every session (and cleared this browser's cookies); forget any cached user.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
      queryClient.setQueryData(["auth", "session"], null);
      setStage({ kind: "done" });
      toast.success("Password saved. You can sign in now.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const isInvite = stage.kind === "ready" && stage.info.purpose === "INVITE";

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-soft px-4 py-10">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> {isInvite ? "Welcome! Choose your password" : "Choose a new password"}
          </CardTitle>
          {stage.kind === "ready" && (
            <CardDescription>
              For <span className="font-medium text-foreground">{stage.info.email}</span>. This link works once and expires on {new Date(stage.info.expiresAt).toLocaleString()}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {stage.kind === "checking" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking the link...</p>
          )}

          {stage.kind === "invalid" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p>{stage.message}</p>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">Request a new link</Link>
            </div>
          )}

          {stage.kind === "ready" && (
            <form className="space-y-3" onSubmit={(event) => void submit(event)}>
              {/* Lets password managers save the new password for the right account. */}
              <input type="text" name="username" autoComplete="username" value={stage.info.email} readOnly hidden />
              <div className="space-y-1">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                {tooShort && <p className="text-xs text-destructive">At least {MIN_LENGTH} characters.</p>}
                {tooLong && <p className="text-xs text-destructive">Too long.</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>
              <Button className="w-full gap-2" type="submit" disabled={!canSubmit}>
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save password"}
              </Button>
            </form>
          )}

          {stage.kind === "done" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <p>Your password is saved. For your safety, every device that was signed in to this account has been signed out.</p>
              </div>
              <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>Go to sign in</Button>
            </div>
          )}

          {stage.kind !== "done" && (
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
