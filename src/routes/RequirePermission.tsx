import { Navigate, Outlet } from "react-router-dom";

import { usePermissions, type Permissions } from "@/hooks/usePermissions";

type PermissionFlag = Exclude<keyof Permissions, "role">;

/** Sends users without the permission back to the dashboard. The server enforces it as well. */
export function RequirePermission({ permission }: { permission: PermissionFlag }) {
  const permissions = usePermissions();

  if (!permissions[permission]) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
