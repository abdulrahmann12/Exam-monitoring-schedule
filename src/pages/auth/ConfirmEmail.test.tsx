import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangeEmailDialog } from "@/components/uniguard/ChangeEmailDialog";

import ConfirmEmail from "./ConfirmEmail";

const confirmEmailChange = vi.fn();
const requestEmailChange = vi.fn();

vi.mock("@/services", () => ({ authService: { confirmEmailChange: (...args: unknown[]) => confirmEmailChange(...args), requestEmailChange: (...args: unknown[]) => requestEmailChange(...args) } }));

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><ConfirmEmail /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  confirmEmailChange.mockReset();
  requestEmailChange.mockReset();
});

describe("confirm new email page", () => {
  it("confirms only after a click, then removes the secret from the address", async () => {
    window.history.replaceState(null, "", "/confirm-email#token=abc123");
    confirmEmailChange.mockResolvedValue({ success: true, data: { message: "Your sign-in email is now new@x.test. Sign in again with it." }, error: null });
    renderPage();

    expect(window.location.hash).toBe("");
    expect(confirmEmailChange).not.toHaveBeenCalled(); // mail scanners opening the link change nothing
    fireEvent.click(screen.getByRole("button", { name: "Confirm new email" }));

    expect(await screen.findByText("Email changed")).toBeInTheDocument();
    expect(confirmEmailChange).toHaveBeenCalledWith("abc123");
  });

  it("explains an incomplete link", () => {
    window.history.replaceState(null, "", "/confirm-email");
    renderPage();
    expect(screen.getByText("Link not valid")).toBeInTheDocument();
  });
});

describe("change email dialog", () => {
  it("needs a different valid email and the password, then says to check the inbox", async () => {
    requestEmailChange.mockResolvedValue({ success: true, data: { newEmail: "new@x.test", expiresAt: "2026-11-08T00:00:00Z", emailSent: true, devLink: null }, error: null });
    render(<ChangeEmailDialog currentEmail="owner@x.test" onClose={vi.fn()} />);
    const send = screen.getByRole("button", { name: "Send confirmation link" });

    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "OWNER@x.test" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret-pass-1" } });
    expect(send).toBeDisabled(); // same as now

    fireEvent.change(screen.getByLabelText("New email"), { target: { value: " new@x.test " } });
    fireEvent.click(send);

    expect(await screen.findByText("Check your new inbox")).toBeInTheDocument();
    expect(requestEmailChange).toHaveBeenCalledWith({ newEmail: "new@x.test", currentPassword: "secret-pass-1" });
    expect(screen.queryByText("Local test mode")).not.toBeInTheDocument();
  });
});
