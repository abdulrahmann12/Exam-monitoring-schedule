import { isDemoUser } from "@/lib/demoMode";
import { useAuth } from "@/state/auth";

export function useDemoUser() {
  const { user } = useAuth();

  return isDemoUser(user);
}