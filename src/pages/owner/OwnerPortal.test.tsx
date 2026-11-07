import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { OwnerOverview, OwnerUniversity } from "@/api";

import OwnerOverviewPage from "./OwnerOverview";
import OwnerUniversities from "./OwnerUniversities";

const recent = new Date(Date.now() - 2 * 3600000).toISOString();

function uni(overrides: Partial<OwnerUniversity>): OwnerUniversity {
  return {
    id: "u1", name: "Cairo University", slug: "cairo", active: true, createdAt: recent,
    accounts: 5, people: 20, rooms: 4, scheduledExamRooms: 10, lastSignInAt: recent, lastActivityAt: recent,
    admins: [{ id: "a1", email: "sara@cairo.edu", displayName: "Sara", enabled: true, signedIn: true, invitationPending: false, twoFactorEnabled: true }],
    ...overrides,
  };
}

const overview: OwnerOverview = {
  totals: { universities: 3, activeUniversities: 2, accounts: 12, people: 40, scheduledExamRooms: 25 },
  universities: [
    uni({}),
    uni({ id: "u2", name: "Alex Institute", slug: "alex", admins: [] }),
    uni({ id: "u3", name: "Old College", slug: "old", active: false }),
  ],
};

vi.mock("@/hooks", () => ({
  useOwnerOverviewQuery: () => ({ data: overview, isLoading: false, isError: false, refetch: vi.fn() }),
  useOwnerActivityQuery: () => ({ data: { items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 }, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateUniversityMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUniversityMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddUniversityAdminMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetAdminTwoFactorMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/state/auth", () => ({ useAuth: () => ({ user: { email: "owner@x.test", displayName: "Nour Owner" } }) }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/owner" element={<OwnerOverviewPage />} />
        <Route path="/owner/universities" element={<OwnerUniversities />} />
        <Route path="/owner/account" element={<p>account page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("owner overview", () => {
  it("shows the totals and the universities that need attention", () => {
    renderAt("/owner");
    expect(screen.getByRole("heading", { name: /, Nour$/ })).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Alex Institute.*No administrator/ })).toHaveAttribute("href", "/owner/universities?open=u2");
    expect(screen.queryByRole("link", { name: /Old College/ })).not.toBeInTheDocument(); // switched off: nothing to fix
  });

  it("sends a Microsoft / Google link result on to the account page", () => {
    renderAt("/owner?sso=linked");
    expect(screen.getByText("account page")).toBeInTheDocument();
  });
});

describe("owner universities", () => {
  it("searches and filters", () => {
    renderAt("/owner/universities");
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("Search universities"), { target: { value: "sara@" } });
    expect(screen.getAllByRole("button", { name: /^Actions for/ }).map((el) => el.getAttribute("aria-label"))).toEqual([
      "Actions for Cairo University", "Actions for Old College",
    ]);

    fireEvent.change(screen.getByLabelText("Search universities"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("tab", { name: /Switched off/ }));
    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: /Needs attention/ }));
    expect(screen.getByRole("button", { name: "Actions for Alex Institute" })).toBeInTheDocument();
  });

  it("opens a university's details from the address", () => {
    renderAt("/owner/universities?open=u1");
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("Cairo University")).toBeInTheDocument();
    expect(within(panel).getByText("Sara")).toBeInTheDocument();
    expect(within(panel).getByText("Two-step on")).toBeInTheDocument();
  });

  it("opens the new-university form from the overview button", () => {
    renderAt("/owner/universities?new=1");
    expect(screen.getByRole("dialog", { name: "New university" })).toBeInTheDocument();
  });
});
