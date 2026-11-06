import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import type { AuthResponse, CurrentSession, LoginOutcome, LoginRequest, ServiceResponse } from "@/api";
import { twoFactorService } from "@/api";
import { clearLegacyAuthStorage, onSessionEnded } from "@/api/utils/authStorage";
import { clearDemoSandbox, syncDemoSandboxUser } from "@/api/utils/demoSandbox";
import { LOGIN_ROUTE, redirectToLogin, registerNavigationHandler } from "@/api/utils/navigation";
import { authService } from "@/services";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

interface AuthContextValue {
  user: CurrentSession | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  isLoggingIn: boolean;
  isStartingDemo: boolean;
  isVerifyingTwoFactor: boolean;
  /** "two-factor" when the password was right and the code from the app is still needed. */
  login: (payload: LoginRequest) => Promise<LoginOutcome | null>;
  /** Second step of sign-in: code from the authenticator app, or a recovery code. */
  verifyTwoFactor: (code: string) => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => Promise<void>;
  /** Signs this account out on every device (including this one). */
  logoutEverywhere: () => Promise<void>;
  /** Re-reads the signed-in user from the server, e.g. after a password change. */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_QUERY_KEY = ["auth", "session"] as const;

/**
 * The server is the only source of truth: the HttpOnly cookies cannot be read by the app, so
 * "am I signed in?" is answered by GET /api/auth/me. `null` = not signed in.
 */
async function loadCurrentSession(): Promise<CurrentSession | null> {
  const response = await authService.getCurrentSession();
  if (!response.success && response.error.status === 401) {
    return null;
  }
  return unwrapServiceResponse(response);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    clearLegacyAuthStorage(); // older versions kept the token in localStorage
  }, []);

  useEffect(() => registerNavigationHandler((path, options) => navigate(path, options)), [navigate]);

  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: loadCurrentSession,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    syncDemoSandboxUser(sessionQuery.data ?? null);
  }, [sessionQuery.data]);

  /** Forget everything that belonged to the previous user. */
  const resetToSignedOut = useCallback(() => {
    clearDemoSandbox();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
  }, [queryClient]);

  // The API layer reports a session that ended and could not be renewed.
  useEffect(() => onSessionEnded(() => {
    if (queryClient.getQueryData(SESSION_QUERY_KEY)) {
      resetToSignedOut();
    }
    redirectToLogin();
  }), [queryClient, resetToSignedOut]);

  const fetchCurrentUser = useCallback(
    () => queryClient.fetchQuery({ queryKey: SESSION_QUERY_KEY, queryFn: loadCurrentSession, staleTime: 0 }),
    [queryClient],
  );

  const finishSignIn = useCallback(async () => {
    // Data cached for a previous user must never show up for this one.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      throw new Error("Signed in, but the browser did not keep the session cookie. Check that cookies are allowed for this site.");
    }
    return currentUser;
  }, [fetchCurrentUser, queryClient]);

  const authenticate = useCallback(
    async (request: Promise<ServiceResponse<AuthResponse>>) => {
      unwrapServiceResponse(await request);
      return finishSignIn();
    },
    [finishSignIn],
  );

  const onSignedIn = useCallback((currentUser: CurrentSession) => {
    syncDemoSandboxUser(currentUser);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginRequest) => {
      const answer = unwrapServiceResponse(await authService.login(payload));
      // No session yet: the server is waiting for the code from the authenticator app.
      return answer.twoFactorRequired ? null : finishSignIn();
    },
    onSuccess: (currentUser) => {
      if (currentUser) {
        onSignedIn(currentUser);
      }
    },
  });

  const twoFactorMutation = useMutation({
    mutationFn: (code: string) => authenticate(twoFactorService.verify(code)),
    onSuccess: onSignedIn,
  });

  const demoLoginMutation = useMutation({
    mutationFn: () => authenticate(authService.demoLogin()),
    onSuccess: onSignedIn,
  });

  const isLoginPending = loginMutation.isPending;
  const runLogin = loginMutation.mutateAsync;
  const isDemoLoginPending = demoLoginMutation.isPending;
  const runDemoLogin = demoLoginMutation.mutateAsync;

  const login = useCallback(async (payload: LoginRequest): Promise<LoginOutcome | null> => {
    if (isLoginPending || isDemoLoginPending) {
      return null;
    }
    const currentUser = await runLogin(payload);
    return currentUser ? "signed-in" : "two-factor";
  }, [isDemoLoginPending, isLoginPending, runLogin]);

  const isVerifyingTwoFactor = twoFactorMutation.isPending;
  const runVerify = twoFactorMutation.mutateAsync;
  const verifyTwoFactor = useCallback(async (code: string) => {
    await runVerify(code);
  }, [runVerify]);

  const loginWithDemo = useCallback(async () => {
    if (isLoginPending || isDemoLoginPending) {
      return;
    }
    await runDemoLogin();
  }, [isDemoLoginPending, isLoginPending, runDemoLogin]);

  const logout = useCallback(async () => {
    await authService.logout();
    resetToSignedOut();
    navigate(LOGIN_ROUTE, { replace: true });
  }, [navigate, resetToSignedOut]);

  const logoutEverywhere = useCallback(async () => {
    unwrapServiceResponse(await authService.logoutEverywhere());
    resetToSignedOut();
    navigate(LOGIN_ROUTE, { replace: true });
  }, [navigate, resetToSignedOut]);

  const refreshSession = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  const user = sessionQuery.data ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isRestoring: sessionQuery.isLoading,
      isLoggingIn: isLoginPending,
      isStartingDemo: isDemoLoginPending,
      isVerifyingTwoFactor,
      login,
      verifyTwoFactor,
      loginWithDemo,
      logout,
      logoutEverywhere,
      refreshSession,
    }),
    [user, sessionQuery.isLoading, isLoginPending, isDemoLoginPending, isVerifyingTwoFactor, login, verifyTwoFactor, loginWithDemo, logout, logoutEverywhere, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
