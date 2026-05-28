import { LoaderCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { API_BASE_URL, ApiError } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { useAuth } from "@/state/auth";
import { getErrorMessage } from "@/utils/error";
import { toast } from "sonner";

export default function Login() {
  const { appName, appTagline } = useBranding();
  const { isLoggingIn, isStartingDemo, login, loginWithDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const isAuthenticating = isLoggingIn || isStartingDemo;
  const backendTarget = (() => {
    try {
      return new URL(API_BASE_URL).host;
    } catch {
      return API_BASE_URL;
    }
  })();

  const invalidCredentialsHint =
    loginError === "Invalid email or password."
      ? `This app is currently signing in against ${backendTarget}. If local login works but this one fails, verify the deployed admin email and password for that backend and restart the service after updating its bootstrap auth configuration.`
      : null;

  function handleAuthError(error: unknown) {
    const message = getErrorMessage(error);
    setLoginError(message);

    if (error instanceof ApiError) {
      return;
    }

    toast.error(message);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    try {
      await login({ email: email.trim(), password });
      toast.success("Signed in successfully.");
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function handleDemoLogin() {
    setLoginError(null);

    try {
      await loginWithDemo();
      toast.success("Demo ready. Redirecting to dashboard.");
    } catch (error) {
      handleAuthError(error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-soft px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_0.85fr]">
          <section className="order-2 rounded-3xl border border-border bg-card/70 p-8 shadow-card backdrop-blur lg:order-1 lg:flex lg:flex-col lg:justify-between lg:p-10">
            <div className="space-y-5">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elevated">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                  <PlayCircle className="h-3.5 w-3.5" />
                  Live scheduling demo
                </div>
                <h1 className="text-display text-4xl font-bold tracking-tight">{appName}</h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  {appTagline}
                </p>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Sign in with an administrator account or open the demo. Demo changes stay in this browser and reset after refresh.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Admin access</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">Use your existing secure sign-in flow</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Demo mode</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">Explore the app safely with temporary data</p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-border/80 bg-background/70 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">What opens after login</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Dashboard, rooms, people, time slots, assignments, and scheduler tools are all available from the same protected workspace.
              </p>
            </div>
          </section>

          <Card className="order-1 border-border bg-card/90 shadow-card backdrop-blur lg:order-2">
            <CardHeader className="space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure admin access
              </div>
              <div>
                <CardTitle className="text-2xl">Sign in to {appName}</CardTitle>
                <CardDescription className="mt-2">
                  Sign in with your admin account or launch the demo instantly.
                </CardDescription>
              </div>
              <p className="text-xs text-muted-foreground">Active backend: {backendTarget}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form aria-busy={isAuthenticating} className="space-y-5" onSubmit={handleSubmit}>
                {loginError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to continue</AlertTitle>
                    <AlertDescription>
                      <p>{loginError}</p>
                      {invalidCredentialsHint ? <p className="mt-2">{invalidCredentialsHint}</p> : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@uniguard.local"
                    value={email}
                    disabled={isAuthenticating}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (loginError) {
                        setLoginError(null);
                      }
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    disabled={isAuthenticating}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (loginError) {
                        setLoginError(null);
                      }
                    }}
                    required
                  />
                </div>
                <Button className="w-full gap-2" disabled={isAuthenticating} type="submit">
                  {isLoggingIn ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {isLoggingIn ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Try the demo</p>
                      <p className="text-sm leading-6 text-muted-foreground" id="demo-login-description">
                        Open the full app with temporary data that resets on refresh.
                      </p>
                    </div>
                    <Button
                      aria-describedby="demo-login-description"
                      className="w-full gap-2"
                      disabled={isAuthenticating}
                      onClick={() => void handleDemoLogin()}
                      type="button"
                      variant="outline"
                    >
                      {isStartingDemo ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      {isStartingDemo ? "Launching demo..." : "Try Live Demo"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}