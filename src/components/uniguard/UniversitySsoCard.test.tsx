import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UniversitySsoCard } from "./UniversitySsoCard";

const providers = vi.hoisted(() => ({ list: [] as Array<{ id: string; name: string }> }));

vi.mock("@/hooks/useSso", () => ({
  useSsoProvidersQuery: () => ({ isLoading: false, data: providers.list }),
  useUniversitySsoQuery: () => ({ isLoading: false, data: { microsoftTenantId: null } }),
  useUpdateUniversitySsoMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

describe("university Microsoft sign-in card", () => {
  it("explains what is missing when the server has no Microsoft app (instead of an empty page)", () => {
    providers.list = [];
    render(<UniversitySsoCard />);
    expect(screen.getByText("Not switched on for this server yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Microsoft tenant id")).not.toBeInTheDocument();
  });

  it("lets the administrator enter the tenant once Microsoft is available", () => {
    providers.list = [{ id: "microsoft", name: "Microsoft" }];
    render(<UniversitySsoCard />);
    expect(screen.getByLabelText("Microsoft tenant id")).toBeInTheDocument();
  });
});
