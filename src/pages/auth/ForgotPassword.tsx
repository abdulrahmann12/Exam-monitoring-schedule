import { ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";
import { getErrorMessage } from "@/utils/error";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

/** Asks for an email and sends a reset link. Never says whether the account exists. */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      const response = unwrapServiceResponse(await authService.forgotPassword(email.trim()));
      setSentMessage(response.message);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-soft px-4 py-10">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot your password?</CardTitle>
          <CardDescription>Enter the email of your account and we will send you a link to choose a new password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sentMessage ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <p>{sentMessage}</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input id="forgot-email" type="email" autoComplete="email" required value={email} disabled={sending} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full gap-2" type="submit" disabled={sending || !email.trim()}>
                {sending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {sending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
