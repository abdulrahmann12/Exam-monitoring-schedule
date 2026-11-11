import { Navigate, Route, Routes } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import Index from "@/pages/Index";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Login from "@/pages/auth/Login";
import ConfirmEmail from "@/pages/auth/ConfirmEmail";
import ResetPassword from "@/pages/auth/ResetPassword";
import People from "@/pages/uniguard/People";
import Rooms from "@/pages/uniguard/Rooms";
import Assignments from "@/pages/uniguard/Assignments";
import Scheduler from "@/pages/uniguard/Scheduler";
import RoomAllocation from "@/pages/uniguard/RoomAllocation";
import Settings from "@/pages/uniguard/Settings";
import TimeSlots from "@/pages/uniguard/TimeSlots";
import Timeline from "@/pages/uniguard/Timeline";
import Activity from "@/pages/uniguard/Activity";
import Users from "@/pages/uniguard/Users";
import Emails from "@/pages/uniguard/Emails";
import Reports from "@/pages/uniguard/Reports";
import UserGuide from "@/pages/uniguard/UserGuide";
import UserGuideRead from "@/pages/uniguard/UserGuideRead";
import OwnerAccount from "@/pages/owner/OwnerAccount";
import OwnerActivity from "@/pages/owner/OwnerActivity";
import OwnerLayout from "@/pages/owner/OwnerLayout";
import OwnerOverview from "@/pages/owner/OwnerOverview";
import OwnerUniversities from "@/pages/owner/OwnerUniversities";
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
      <Route path="/confirm-email" element={<ConfirmEmail />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Index />} />
        <Route path="/people" element={<People />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route element={<RequirePermission permission="canEdit" />}>
          <Route path="/scheduler" element={schedulerElement} />
          <Route path="/room-allocation" element={<RoomAllocation />} />
        </Route>
        <Route path="/timeline" element={timelineElement} />
        <Route path="/time-slots" element={<TimeSlots />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/user-guide" element={<UserGuide />} />
        <Route path="/user-guide/read" element={<UserGuideRead />} />
        <Route element={<RequirePermission permission="canViewEmails" />}>
          <Route path="/emails" element={<Emails />} />
        </Route>
        <Route element={<RequirePermission permission="canManageUsers" />}>
          <Route path="/users" element={<Users />} />
          <Route path="/activity" element={<Activity />} />
        </Route>
      </Route>

      <Route element={<OwnerRoute />}>
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<OwnerOverview />} />
          <Route path="universities" element={<OwnerUniversities />} />
          <Route path="activity" element={<OwnerActivity />} />
          <Route path="account" element={<OwnerAccount />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}