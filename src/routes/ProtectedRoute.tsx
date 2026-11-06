import { Navigate, Outlet, useLocation } from "react-router-dom";

import { DemoModeBanner } from "@/components/uniguard/DemoModeBanner";
import ForcePasswordChange from "@/pages/auth/ForcePasswordChange";
import { resolveRole } from "@/hooks/usePermissions";
import { useAuth } from "@/state/auth";
import { ScheduleGroupProvider } from "@/state/scheduleGroup";

function RouteLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-soft px-6">
      <div className="rounded-xl border border-border bg-card px-6 py-5 text-center shadow-card">
        <div className="text-sm font-medium">Restoring session...</div>
        <div className="mt-1 text-xs text-muted-foreground">Checking your access token.</div>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isRestoring, user } = useAuth();

  if (isRestoring) {
    return <RouteLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // The server refuses everything else until the temporary password is replaced.
  if (user?.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  // The platform owner belongs to no university: it only has the owner panel.
  if (resolveRole(user) === "SUPER_ADMIN") {
    return <Navigate to="/owner" replace />;
  }

  return (
    <ScheduleGroupProvider>
      <DemoModeBanner />
      <Outlet />
    </ScheduleGroupProvider>
  );
}