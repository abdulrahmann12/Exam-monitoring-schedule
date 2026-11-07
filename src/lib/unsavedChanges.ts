import { useEffect } from "react";

/**
 * One app-wide "you have unsaved work" flag. The scheduler sets it; anything that would throw the
 * work away (leaving the page, switching the exam period, signing out) asks first.
 *
 * The app uses a plain BrowserRouter (no route blockers), so in-app links are checked with one
 * click listener and closing / reloading the tab with the browser's own "leave site?" prompt.
 */
let unsavedMessage: string | null = null;

export function setUnsavedChanges(message: string | null): void {
  unsavedMessage = message;
}

export function hasUnsavedChanges(): boolean {
  return unsavedMessage !== null;
}

/** true = go ahead (nothing unsaved, or the person agreed to lose it). */
export function confirmDiscardUnsaved(): boolean {
  return unsavedMessage === null || window.confirm(unsavedMessage);
}

/** While `message` is set: warn before closing/reloading the tab and before following in-app links. */
export function useUnsavedChangesGuard(message: string | null): void {
  useEffect(() => {
    setUnsavedChanges(message);
    if (!message) {
      return undefined;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // older browsers need this to show the prompt
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // opening in a new tab keeps this page (and its work) alive
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.origin !== window.location.origin) {
        return;
      }
      if (link.pathname === window.location.pathname) {
        return;
      }
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      setUnsavedChanges(null);
    };
  }, [message]);
}
