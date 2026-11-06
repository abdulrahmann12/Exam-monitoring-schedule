export const LOGIN_ROUTE = "/login";

/**
 * Pages a signed-out visitor must be able to stay on. A "not signed in" answer from the server
 * (e.g. the startup GET /api/auth/me) must not push them to the sign-in page — otherwise the
 * password link from an invitation or "forgot password" email closes before it can be used.
 */
export const PUBLIC_ROUTES: readonly string[] = [LOGIN_ROUTE, "/forgot-password", "/reset-password"];

function isPublicRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_ROUTES.includes(path);
}

type NavigationHandler = (route: string, options?: { replace?: boolean }) => void;

let navigationHandler: NavigationHandler | null = null;

export const navigationRuntime = {
  replaceLocation(route: string) {
    window.location.replace(route);
  },
};

export function registerNavigationHandler(handler: NavigationHandler): () => void {
  navigationHandler = handler;

  return () => {
    if (navigationHandler === handler) {
      navigationHandler = null;
    }
  };
}

export function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (isPublicRoute(window.location.pathname)) {
    return;
  }

  if (navigationHandler) {
    navigationHandler(LOGIN_ROUTE, { replace: true });
    return;
  }

  navigationRuntime.replaceLocation(LOGIN_ROUTE);
}
