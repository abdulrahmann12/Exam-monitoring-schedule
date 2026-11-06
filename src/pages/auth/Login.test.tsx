import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api";

import Login from "./Login";

const login = vi.fn();
const verifyTwoFactor = vi.fn();

vi.mock("@/state/auth", () => ({
  useAuth: () => ({
    isLoggingIn: false,
    isStartingDemo: false,
    isVerifyingTwoFactor: false,
    login,
    loginWithDemo: vi.fn(),
    verifyTwoFactor,
  }),
}));

vi.mock("@/lib/branding/BrandingProvider", () => ({
  useBranding: () => ({ appName: "Uni-Guard", appTagline: "Exams" }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function signInWithPassword() {
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sara@uni.edu" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "her-password-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("sign-in with two-step codes", () => {
  beforeEach(() => {
    login.mockReset();
    verifyTwoFactor.mockReset();
  });

  it("asks for the code from the app when the password was right", async () => {
    login.mockResolvedValue("two-factor");
    signInWithPassword();

    const codeInput = await screen.findByLabelText("6-digit code");
    expect(login).toHaveBeenCalledWith({ email: "sara@uni.edu", password: "her-password-1" });
    const verify = screen.getByRole("button", { name: "Verify and sign in" });
    expect(verify).toBeDisabled();

    fireEvent.change(codeInput, { target: { value: "12a3456" } });
    expect((codeInput as HTMLInputElement).value).toBe("123456"); // letters are ignored
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    await waitFor(() => expect(verifyTwoFactor).toHaveBeenCalledWith("123456"));
  });

  it("accepts a recovery code instead", async () => {
    login.mockResolvedValue("two-factor");
    signInWithPassword();
    fireEvent.click(await screen.findByRole("button", { name: /use a recovery code/i }));

    const input = screen.getByLabelText("Recovery code");
    fireEvent.change(input, { target: { value: "abcde-fgh23" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(verifyTwoFactor).toHaveBeenCalledWith("abcde-fgh23"));
  });

  it("goes back to the password when the step expired", async () => {
    login.mockResolvedValue("two-factor");
    verifyTwoFactor.mockRejectedValue(new ApiError({
      message: "Your sign-in step expired. Please sign in again with your password.",
      status: 401,
    }));
    signInWithPassword();
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));

    expect(await screen.findByText(/sign in again with your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("does not show the code step for accounts without two-step sign-in", async () => {
    login.mockResolvedValue("signed-in");
    signInWithPassword();
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });
});
