import { useOptionalAuth } from "@/state/auth";

/**
 * Invisible "username" field placed next to a current-password box. It tells the browser's
 * password manager which account this is, so it suggests only that account's saved password
 * instead of listing every saved login.
 */
export function AccountUsernameHint() {
  const user = useOptionalAuth()?.user;
  if (!user?.email) return null;
  return <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />;
}
