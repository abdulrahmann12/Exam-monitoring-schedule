import { Navigate, Outlet, useLocation } from "react-router-dom";

import { DemoModeBanner } from "@/components/uniguard/DemoModeBanner";
import { useAuth } from "@/state/auth";

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
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) {
    return <RouteLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <>
      <DemoModeBanner />
      <Outlet />
    </>
  );
}