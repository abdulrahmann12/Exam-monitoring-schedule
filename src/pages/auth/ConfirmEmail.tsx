import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, LoaderCircle, MailCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { unwrapServiceResponse } from "@/api/utils/serviceResponse";
import { Button } from "@/components/ui/button";
import { authService } from "@/services";
import { getErrorMessage } from "@/utils/error";

/** Reads the secret from the address (after '#token=', which browsers never send to a server). */
function readTokenFromAddress(): string | null {
  const match = /(?:^#|&)token=([^&]+)/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}

type Stage = { kind: "ready" } | { kind: "saving" } | { kind: "done"; message: string } | { kind: "invalid"; message: string };

/**
 * Opened from the email sent to a NEW sign-in address. It asks for one click instead of confirming
 * on load, so mail scanners that open links automatically cannot confirm on the person's behalf.
 */
export default function ConfirmEmail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token] = useState(readTokenFromAddress);
  const [stage, setStage] = useState<Stage>(() =>
    token ? { kind: "ready" } : { kind: "invalid", message: "This link is incomplete. Open it again from the email." });

  useEffect(() => {
    // Remove the secret from the address bar so it does not stay in the browser history.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function confirm() {
    if (!token) return;
    setStage({ kind: "saving" });
    try {
      const result = unwrapServiceResponse(await authService.confirmEmailChange(token));
      // Every device was signed out (this browser too): forget the cached user.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
      queryClient.setQueryData(["auth", "session"], null);
      setStage({ kind: "done", message: result.message });
    } catch (error) {
      setStage({ kind: "invalid", message: getErrorMessage(error) });
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-soft px-4 py-10">
      <div className="w-full max-w-[26rem] rounded-3xl border border-border/70 bg-card/95 p-6 text-center shadow-card sm:p-8">
        {stage.kind === "done" ? (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-7 w-7" /></div>
            <h1 className="text-xl font-semibold">Email changed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{stage.message} For your safety, every device was signed out.</p>
            <Button className="mt-6 h-11 w-full" onClick={() => navigate("/login", { replace: true })}>Go to sign in</Button>
          </>
        ) : stage.kind === "invalid" ? (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive"><TriangleAlert className="h-7 w-7" /></div>
            <h1 className="text-xl font-semibold">Link not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">{stage.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">Links work once and expire after 24 hours. Start the change again from your account page.</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><MailCheck className="h-7 w-7" /></div>
            <h1 className="text-xl font-semibold">Confirm your new email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Click below to start signing in with this email address. Every device will be signed out, then you sign in again with the new email.
            </p>
            <Button className="mt-6 h-11 w-full gap-2" disabled={stage.kind === "saving"} onClick={() => void confirm()}>
              {stage.kind === "saving" && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {stage.kind === "saving" ? "Confirming..." : "Confirm new email"}
            </Button>
          </>
        )}
        {stage.kind !== "done" && (
          <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
