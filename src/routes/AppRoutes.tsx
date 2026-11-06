import { Navigate, Route, Routes } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import Index from "@/pages/Index";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Login from "@/pages/auth/Login";
import ResetPassword from "@/pages/auth/ResetPassword";
import People from "@/pages/uniguard/People";
import Rooms from "@/pages/uniguard/Rooms";
import Assignments from "@/pages/uniguard/Assignments";
import Scheduler from "@/pages/uniguard/Scheduler";
import Settings from "@/pages/uniguard/Settings";
import TimeSlots from "@/pages/uniguard/TimeSlots";
import Timeline from "@/pages/uniguard/Timeline";
import Activity from "@/pages/uniguard/Activity";
import Users from "@/pages/uniguard/Users";
import Emails from "@/pages/uniguard/Emails";
import OwnerPanel from "@/pages/owner/OwnerPanel";
import { UniGuardProvider } from "@/lib/uniguard/store";

import { OwnerRoute } from "./OwnerRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { RequirePermission } from "./RequirePermission";

export function AppRoutes() {
  const schedulerElement = (
    <UniGuardProvider>
      <Scheduler />
    </UniGuardProvider>
  );

  const timelineElement = (
    <UniGuardProvider>
      <Timeline />
    </UniGuardProvider>
  );

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Index />} />
        <Route path="/people" element={<People />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route element={<RequirePermission permission="canEdit" />}>
          <Route path="/scheduler" element={schedulerElement} />
        </Route>
        <Route path="/timeline" element={timelineElement} />
        <Route path="/time-slots" element={<TimeSlots />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/settings" element={<Settings />} />
        <Route element={<RequirePermission permission="canViewEmails" />}>
          <Route path="/emails" element={<Emails />} />
        </Route>
        <Route element={<RequirePermission permission="canManageUsers" />}>
          <Route path="/users" element={<Users />} />
          <Route path="/activity" element={<Activity />} />
        </Route>
      </Route>

      <Route element={<OwnerRoute />}>
        <Route path="/owner" element={<OwnerPanel />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}