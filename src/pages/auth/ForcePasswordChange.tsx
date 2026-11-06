import { LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChangePasswordCard } from "@/components/uniguard/ChangePasswordCard";
import { useAuth } from "@/state/auth";

/**
 * Shown instead of the app while the account still has the temporary password an administrator
 * set. The server blocks every other request until the password is changed.
 */
export default function ForcePasswordChange() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-soft px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <div className="font-medium">Choose your own password</div>
            <p className="text-muted-foreground">
              {user?.email} is signed in with a temporary password from your administrator. Enter it as the current password, then pick a new one only you know.
            </p>
          </div>
        </div>
        <ChangePasswordCard title="New password" description="At least 10 characters. You stay signed in on this device." />
        <Button variant="ghost" className="w-full gap-2" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
