import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { AuthSession, CurrentSession, LoginRequest, ServiceResponse } from "@/api";
import { clearDemoSandbox, syncDemoSandboxUser } from "@/api/utils/demoSandbox";
import { LOGIN_ROUTE, registerNavigationHandler } from "@/api/utils/navigation";
import { getAuthSession } from "@/lib/auth-storage";
import { authService } from "@/services";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

interface AuthContextValue {
  session: AuthSession | null;
  user: CurrentSession | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  isLoggingIn: boolean;
  isStartingDemo: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentSession(): Promise<CurrentSession> {
  return unwrapServiceResponse(await authService.getCurrentSession());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  useEffect(() => {
    setSession(getAuthSession());
  }, [location.pathname]);

  useEffect(() => registerNavigationHandler((path, options) => navigate(path, options)), [navigate]);

  const sessionQuery = useQuery({
    queryKey: ["auth", "session", session?.accessToken],
    queryFn: loadCurrentSession,
    enabled: Boolean(session?.accessToken),
  });

  useEffect(() => {
    syncDemoSandboxUser(sessionQuery.data ?? null);
  }, [sessionQuery.data]);

  const authenticate = useCallback(
    async (request: Promise<ServiceResponse<AuthSession>>) => {
      const authSession = unwrapServiceResponse(await request);
      const currentUser = await queryClient.fetchQuery({
        queryKey: ["auth", "session", authSession.accessToken],
        queryFn: loadCurrentSession,
      });

      return { authSession, currentUser };
    },
    [queryClient],
  );

  const handleLoginSuccess = useCallback((authSession: AuthSession) => {
    setSession(authSession);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => authenticate(authService.login(payload)),
    onSuccess: ({ authSession, currentUser }) => {
      syncDemoSandboxUser(currentUser);
      handleLoginSuccess(authSession);
    },
  });

  const demoLoginMutation = useMutation({
    mutationFn: () => authenticate(authService.demoLogin()),
    onSuccess: ({ authSession, currentUser }) => {
      syncDemoSandboxUser(currentUser);
      handleLoginSuccess(authSession);
    },
  });

  const isLoginPending = loginMutation.isPending;
  const runLogin = loginMutation.mutateAsync;
  const isDemoLoginPending = demoLoginMutation.isPending;
  const runDemoLogin = demoLoginMutation.mutateAsync;

  const login = useCallback(async (payload: LoginRequest) => {
    if (isLoginPending || isDemoLoginPending) {
      return;
    }

    await runLogin(payload);
  }, [isDemoLoginPending, isLoginPending, runLogin]);

  const loginWithDemo = useCallback(async () => {
    if (isLoginPending || isDemoLoginPending) {
      return;
    }

    await runDemoLogin();
  }, [isDemoLoginPending, isLoginPending, runDemoLogin]);

  const logout = useCallback(async () => {
    await authService.logout();
    clearDemoSandbox();
    setSession(null);
    queryClient.clear();
    navigate(LOGIN_ROUTE, { replace: true });
  }, [navigate, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: sessionQuery.data ?? null,
      isAuthenticated: Boolean(session?.accessToken && sessionQuery.data),
      isRestoring: Boolean(session?.accessToken) && sessionQuery.isLoading,
      isLoggingIn: isLoginPending,
      isStartingDemo: isDemoLoginPending,
      login,
      loginWithDemo,
      logout,
    }),
    [
      isDemoLoginPending,
      isLoginPending,
      login,
      loginWithDemo,
      logout,
      session,
      sessionQuery.data,
      sessionQuery.isLoading,
    ],
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