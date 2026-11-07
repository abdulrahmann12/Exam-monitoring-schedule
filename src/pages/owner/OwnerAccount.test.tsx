import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import OwnerAccount from "./OwnerAccount";

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks", () => ({
  useUpdateProfileMutation: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/state/auth", () => ({
  useAuth: () => ({ user: { email: "owner@x.test", displayName: "Platform owner", twoFactorEnabled: false } }),
}));
vi.mock("@/components/uniguard/TwoFactorCard", () => ({ TwoFactorCard: () => null }));
vi.mock("@/components/uniguard/ChangePasswordCard", () => ({ ChangePasswordCard: () => null }));
vi.mock("@/components/uniguard/ConnectedAccountsCard", () => ({ ConnectedAccountsCard: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("owner account", () => {
  it("lets the owner change their own name", async () => {
    render(<MemoryRouter><OwnerAccount /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Edit name/ }));

    const input = screen.getByLabelText("Your name");
    const save = screen.getByRole("button", { name: "Save name" });
    expect(save).toBeDisabled(); // unchanged

    fireEvent.change(input, { target: { value: "   " } });
    expect(save).toBeDisabled(); // blank

    fireEvent.change(input, { target: { value: "  Abdulrahman   Ahmed " } });
    fireEvent.click(save);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("Abdulrahman Ahmed"));
  });

  it("warns when two-step sign-in is off", () => {
    render(<MemoryRouter><OwnerAccount /></MemoryRouter>);
    expect(screen.getByText("Two-step sign-in is off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set up now/ })).toBeInTheDocument();
  });
});
