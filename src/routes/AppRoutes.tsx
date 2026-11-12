import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "@/pages/auth/Login";
import { UniGuardProvider } from "@/lib/uniguard/store";

import { OwnerRoute } from "./OwnerRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { RequirePermission } from "./RequirePermission";

/**
 * Pages are loaded when first opened (one small file each) instead of all in one big download.
 * After the first screen is shown, the browser fetches the others in the background while idle,
 * so moving around stays instant.
 */
const preloads: Array<() => Promise<unknown>> = [];
function page<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  preloads.push(load);
  return lazy(load);
}

const NotFound = page(() => import("@/pages/NotFound"));
const Index = page(() => import("@/pages/Index"));
const ForgotPassword = page(() => import("@/pages/auth/ForgotPassword"));
const ConfirmEmail = page(() => import("@/pages/auth/ConfirmEmail"));
const ResetPassword = page(() => import("@/pages/auth/ResetPassword"));
const People = page(() => import("@/pages/uniguard/People"));
const Rooms = page(() => import("@/pages/uniguard/Rooms"));
const Assignments = page(() => import("@/pages/uniguard/Assignments"));
const Scheduler = page(() => import("@/pages/uniguard/Scheduler"));
const RoomAllocation = page(() => import("@/pages/uniguard/RoomAllocation"));
const Settings = page(() => import("@/pages/uniguard/Settings"));
const TimeSlots = page(() => import("@/pages/uniguard/TimeSlots"));
const Timeline = page(() => import("@/pages/uniguard/Timeline"));
const Activity = page(() => import("@/pages/uniguard/Activity"));
const Users = page(() => import("@/pages/uniguard/Users"));
const Emails = page(() => import("@/pages/uniguard/Emails"));
const Reports = page(() => import("@/pages/uniguard/Reports"));
const UserGuide = page(() => import("@/pages/uniguard/UserGuide"));
const UserGuideRead = page(() => import("@/pages/uniguard/UserGuideRead"));
const OwnerAccount = page(() => import("@/pages/owner/OwnerAccount"));
const OwnerActivity = page(() => import("@/pages/owner/OwnerActivity"));
const OwnerLayout = page(() => import("@/pages/owner/OwnerLayout"));
const OwnerOverview = page(() => import("@/pages/owner/OwnerOverview"));
const OwnerUniversities = page(() => import("@/pages/owner/OwnerUniversities"));

function preloadPages() {
  const run = () => preloads.forEach((load) => { void load().catch(() => undefined); });
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
  if (idle) idle(run); else window.setTimeout(run, 1500);
}

function PageLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status" aria-label="Loading page">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  );
}

export function AppRoutes() {
  useEffect(() => {
    const timer = window.setTimeout(preloadPages, 2000);
    return () => window.clearTimeout(timer);
  }, []);

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
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
  );
}