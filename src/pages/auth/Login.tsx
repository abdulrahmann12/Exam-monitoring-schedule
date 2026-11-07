import { ArrowLeft, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Lock, Mail, PlayCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { API_BASE_URL, ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { ssoService } from "@/api";
import { useSsoProvidersQuery } from "@/hooks/useSso";
import { ssoErrorMessage } from "@/lib/sso/messages";
import { useAuth } from "@/state/auth";
import { getErrorMessage } from "@/utils/error";
import { toast } from "sonner";

/** One short line under the heading, e.g. "Invalid email or password." */
function FormError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <CircleAlert className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function Login() {
  const { appName, appTagline } = useBranding();
  const { isLoggingIn, isStartingDemo, isVerifyingTwoFactor, login, loginWithDemo, verifyTwoFactor } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Back from Microsoft / Google: an error code (fixed texts only), or "enter your two-step code".
  const [loginError, setLoginError] = useState<string | null>(() => ssoErrorMessage(searchParams.get("sso_error")));
  const [step, setStep] = useState<"password" | "code">(() => (searchParams.get("step") === "two-factor" ? "code" : "password"));
  const providers = useSsoProvidersQuery().data ?? [];

  useEffect(() => {
    if (searchParams.has("sso_error") || searchParams.has("step")) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const isAuthenticating = isLoggingIn || isStartingDemo || isVerifyingTwoFactor;
  const backendTarget = (() => {
    if (!API_BASE_URL) {
      return `${window.location.host}/api`; // same site: the hosting forwards /api to the backend
    }
    try {
      return new URL(API_BASE_URL).host;
    } catch {
      return API_BASE_URL;
    }
  })();

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
      const outcome = await login({ email: email.trim(), password });
      if (outcome === "two-factor") {
        setPassword("");
        setShowPassword(false);
        setCode("");
        setUseRecoveryCode(false);
        setStep("code");
      } else if (outcome === "signed-in") {
        toast.success("Signed in successfully.");
      }
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    try {
      await verifyTwoFactor(code.trim());
      toast.success("Signed in successfully.");
    } catch (error) {
      const message = getErrorMessage(error);
      if (/sign in again/i.test(message)) {
        setStep("password"); // the step expired or was used up: start again with the password
      }
      handleAuthError(error);
      setCode("");
    }
  }

  const codeReady = useRecoveryCode ? code.replace(/[\s-]/g, "").length === 10 : /^\d{6}$/.test(code.replace(/\s/g, ""));

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-soft px-4 py-10">
      {/* soft background glow */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <main className="relative w-full max-w-[26rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elevated">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{appName}</h1>
          {appTagline ? <p className="mt-1 text-sm text-muted-foreground">{appTagline}</p> : null}
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-card backdrop-blur sm:p-8">
          {step === "code" ? (
            <form aria-busy={isAuthenticating} className="space-y-5" onSubmit={handleCodeSubmit}>
              <div className="space-y-1.5 text-center">
                <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Two-step sign-in</h2>
                <p className="text-sm text-muted-foreground">
                  {useRecoveryCode
                    ? "Enter one of your recovery codes (each works once)."
                    : "Open your authenticator app (for example Google Authenticator) and enter the 6-digit code for this account."}
                </p>
              </div>
              {loginError ? <FormError message={loginError} /> : null}
              <div className="space-y-2">
                <Label htmlFor="two-factor-code">{useRecoveryCode ? "Recovery code" : "6-digit code"}</Label>
                <Input
                  id="two-factor-code"
                  inputMode={useRecoveryCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "123456"}
                  maxLength={useRecoveryCode ? 11 : 7}
                  className="h-12 text-center font-mono text-lg tracking-[0.4em]"
                  value={code}
                  disabled={isAuthenticating}
                  onChange={(event) => {
                    setCode(useRecoveryCode ? event.target.value : event.target.value.replace(/[^\d ]/g, ""));
                    if (loginError) {
                      setLoginError(null);
                    }
                  }}
                  autoFocus
                  required
                />
              </div>
              <Button className="h-11 w-full gap-2" disabled={isAuthenticating || !codeReady} type="submit">
                {isVerifyingTwoFactor ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isVerifyingTwoFactor ? "Checking..." : "Verify and sign in"}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setUseRecoveryCode(!useRecoveryCode); setCode(""); setLoginError(null); }}>
                  {useRecoveryCode ? "Use the code from the app" : "Lost your phone? Use a recovery code"}
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setStep("password"); setCode(""); setLoginError(null); }}>
                  <ArrowLeft className="h-3 w-3" />
                  Back to password
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-6 space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to your account to continue.</p>
              </div>

              <form aria-busy={isAuthenticating} className="space-y-4" onSubmit={handleSubmit}>
                {loginError ? <FormError message={loginError} /> : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@university.edu"
                      className="h-11 pl-10"
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="h-11 pl-10 pr-11"
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
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>
                <Button className="mt-2 h-11 w-full gap-2" disabled={isAuthenticating} type="submit">
                  {isLoggingIn ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {isLoggingIn ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              {providers.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {providers.map((provider) => (
                    <Button key={provider.id} asChild variant="outline" className="h-11 w-full" aria-disabled={isAuthenticating}>
                      <a href={ssoService.startUrl(provider.id)}>Sign in with {provider.name}</a>
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                aria-describedby="demo-login-description"
                className="h-11 w-full gap-2"
                disabled={isAuthenticating}
                onClick={() => void handleDemoLogin()}
                type="button"
                variant="outline"
              >
                {isStartingDemo ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {isStartingDemo ? "Launching demo..." : "Try Live Demo"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground" id="demo-login-description">
                Explore with sample data. Nothing is saved, it resets on refresh.
              </p>
            </>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {appName}</p>
          {import.meta.env.DEV ? <p className="mt-1 opacity-70">Backend: {backendTarget}</p> : null}
        </footer>
      </main>
    </div>
  );
}
