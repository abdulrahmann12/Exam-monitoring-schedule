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

vi.mock("@/hooks/useSso", () => ({
  useSsoProvidersQuery: () => ({ data: [{ id: "microsoft", name: "Microsoft" }, { id: "google", name: "Google" }] }),
}));

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

  it("offers the configured Microsoft and Google sign-in buttons", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Sign in with Microsoft" })).toHaveAttribute("href", "/api/auth/sso/microsoft/start");
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", "/api/auth/sso/google/start");
  });

  it("explains a failed Microsoft / Google sign-in with a fixed text only", () => {
    render(<MemoryRouter initialEntries={["/login?sso_error=not_linked"]}><Login /></MemoryRouter>);
    expect(screen.getByText(/not connected to a Uni-Guard account yet/i)).toBeInTheDocument();
  });

  it("never shows text taken from the address bar", () => {
    render(<MemoryRouter initialEntries={["/login?sso_error=%3Cb%3EYour%20account%20was%20hacked%3C%2Fb%3E"]}><Login /></MemoryRouter>);
    expect(screen.queryByText(/hacked/i)).not.toBeInTheDocument();
    expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument();
  });

  it("shows and hides the password with the eye button", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });

  it("asks for the two-step code when coming back from Microsoft / Google", () => {
    render(<MemoryRouter initialEntries={["/login?step=two-factor"]}><Login /></MemoryRouter>);
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });
});
