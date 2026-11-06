/**
 * Messages for ?sso_error=<code>. Only these fixed texts are ever shown: nothing from the address bar
 * is put on the page, so a crafted link cannot display its own text.
 */
const MESSAGES: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  expired: "The sign-in took too long or was started in another browser. Please try again.",
  failed: "The sign-in could not be confirmed. Please try again.",
  not_linked:
    "This account is not connected to a Uni-Guard account yet. Sign in with your password, then connect it under Settings > Connected accounts, or ask your administrator.",
  in_use: "That account is already connected to another Uni-Guard user.",
  already_linked: "Your account is already connected to an account of this provider. Disconnect it first.",
  disabled: "This account is disabled. Contact your administrator.",
  locked: "This account is temporarily locked after too many wrong attempts. Try again later or ask your administrator.",
  paused: "Access for your university is currently paused. Please contact support.",
  unavailable: "This sign-in option is not available right now.",
  busy: "Too many attempts. Please wait a minute and try again.",
};

export function ssoErrorMessage(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }
  return MESSAGES[code] ?? MESSAGES.failed;
}
