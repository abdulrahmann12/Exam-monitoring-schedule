import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmDiscardUnsaved, hasUnsavedChanges, useUnsavedChangesGuard } from "./unsavedChanges";

function Page({ message }: { message: string | null }) {
  useUnsavedChangesGuard(message);
  return <a href="/people">People</a>;
}

afterEach(() => vi.restoreAllMocks());

describe("unsaved changes guard", () => {
  it("asks before following a link and stays when the answer is no", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText, rerender, unmount } = render(<Page message="Leave and lose them?" />);
    expect(hasUnsavedChanges()).toBe(true);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    getByText("People").dispatchEvent(click);
    expect(confirm).toHaveBeenCalledWith("Leave and lose them?");
    expect(click.defaultPrevented).toBe(true);
    expect(confirmDiscardUnsaved()).toBe(false);

    rerender(<Page message={null} />); // saved: no more questions
    confirm.mockClear();
    const stopNavigation = (event: Event) => event.preventDefault(); // the test browser cannot follow links
    document.addEventListener("click", stopNavigation);
    fireEvent.click(getByText("People"));
    document.removeEventListener("click", stopNavigation);
    expect(confirm).not.toHaveBeenCalled();
    expect(confirmDiscardUnsaved()).toBe(true);
    unmount();
  });

  it("lets the browser warn before closing the tab", () => {
    const { unmount } = render(<Page message="unsaved" />);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });
});
