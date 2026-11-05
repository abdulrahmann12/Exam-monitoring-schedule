/**
 * Sign-in no longer keeps anything in browser storage: the server sets HttpOnly cookies that page
 * scripts cannot read. This module only removes what older versions of the app stored, and lets
 * the auth state react when the server session ends.
 */

/** Key used by versions before cookie sign-in (the access token used to live here). */
export const LEGACY_AUTH_STORAGE_KEY = "uniguard.auth.session";

export function clearLegacyAuthStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // Storage may be blocked (private mode); nothing to clean up then.
  }
}

type SessionEndedListener = () => void;

const listeners = new Set<SessionEndedListener>();

/** Called by the API layer when the session is gone and could not be renewed. */
export function notifySessionEnded(): void {
  listeners.forEach((listener) => listener());
}

export function onSessionEnded(listener: SessionEndedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
