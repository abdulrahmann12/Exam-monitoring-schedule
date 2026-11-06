import { Navigate, Outlet, useLocation } from "react-router-dom";

import ForcePasswordChange from "@/pages/auth/ForcePasswordChange";
import { resolveRole } from "@/hooks/usePermissions";
import { useAuth } from "@/state/auth";

/**
 * Pages of the platform owner. Everyone else is sent to their university's dashboard.
 * Only hides the page: the server refuses /api/owner/** to every other role on its own.
 */
export function OwnerRoute() {
  const location = useLocation();
  const { isAuthenticated, isRestoring, user } = useAuth();

  if (isRestoring) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (resolveRole(user) !== "SUPER_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }
  if (user?.mustChangePassword) {
    return <ForcePasswordChange />;
  }
  return <Outlet />;
}
