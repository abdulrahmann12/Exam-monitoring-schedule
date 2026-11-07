import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Activity from "./Activity";

const getEvents = vi.fn();
const today = new Date();
const event = (id: string, summary: string, outcome = "SUCCESS", extra = {}) => ({
  id, occurredAt: today.toISOString(), actorEmail: "admin@local.test", action: "X", category: "AUTH", targetType: null, targetId: null,
  summary, outcome, ipAddress: "0:0:0:0:0:0:0:1", ...extra,
});

vi.mock("@/api", () => ({
  auditService: {
    getEvents: (query: { outcome?: string; size?: number }) => getEvents(query),
    exportCsv: vi.fn(),
  },
}));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

getEvents.mockImplementation(async (query: { outcome?: string; size?: number }) => {
  if (query.size === 1) {
    return { success: true, error: null, data: { items: [], page: 0, size: 1, totalItems: query.outcome === "FAILURE" ? 3 : 0, totalPages: 1 } };
  }
  return { success: true, error: null, data: { items: [
    event("1", "Signed in"),
    event("2", "Wrong password", "FAILURE", { actorEmail: "sara@uni.edu", ipAddress: "41.233.10.5" }),
  ], page: 0, size: 50, totalItems: 2, totalPages: 1 } };
});

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><Activity /></QueryClientProvider>);
}

describe("activity page", () => {
  it("groups by day, flags problems only, and names the local machine", async () => {
    renderPage();
    expect(await screen.findByText("Wrong password")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.getByText("This computer")).toBeInTheDocument();
    expect(screen.getByText("41.233.10.5")).toBeInTheDocument();
  });

  it("summarises the last 7 days and jumps to the failed actions", async () => {
    renderPage();
    expect(await screen.findByText(/failed and/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show failed" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILURE", size: 50, from: expect.any(String) })));
    expect(screen.getByRole("radio", { name: "Last 7 days" })).toHaveAttribute("aria-checked", "true");
  });

  it("filters by a user when their email is clicked", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "sara@uni.edu" }));
    expect(screen.getByLabelText("User email")).toHaveValue("sara@uni.edu");
  });
});
