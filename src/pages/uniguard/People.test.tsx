import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import People from "./People";

const create = vi.fn().mockResolvedValue({});
const remove = vi.fn().mockResolvedValue(undefined);
const mutation = (mutateAsync = vi.fn()) => ({ mutateAsync, isPending: false });

const person = (id: string, name: string, role: string, department: string, totalAssignments: number, extra = {}) => ({
  id, name, role, department, totalAssignments, email: null, availableDays: ["Sun", "Mon", "Tue", "Wed", "Thu"], active: true,
  maxParallelRooms: 1, subjectCodes: [], createdAt: "", updatedAt: "", ...extra,
});

vi.mock("@/hooks", () => ({
  usePeopleQuery: () => ({
    isLoading: false, isError: false,
    data: { items: [
      person("1", "Dr. Laila Fawzy", "CHIEF_INVIGILATOR", "Exams Office", 0, { email: "laila@uni.edu" }),
      person("2", "Dr. Omar Nabil", "CHIEF_INVIGILATOR", "Exams Office", 9),
      person("3", "Ahmed Ali", "INVIGILATOR", "Physics", 2, { subjectCodes: ["PHY101"] }),
    ] },
  }),
  useCreatePersonMutation: () => mutation(create),
  useUpdatePersonMutation: () => mutation(),
  useDeletePersonMutation: () => mutation(remove),
  useUploadPeopleBulkMutation: () => mutation(),
  useDownloadPeopleTemplateMutation: () => mutation(),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canEdit: true }) }));
vi.mock("@/hooks/useSettings", () => ({ useSettingsQuery: () => ({ data: { chiefMaxParallelRooms: 3 } }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("@/components/uniguard/UnavailabilityPanel", () => ({ UnavailabilityPanel: () => <p>leave panel</p> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><People /></QueryClientProvider>);
}

describe("people page", () => {
  it("filters by role and searches name, email, department and subjects", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /Everyone/ })).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("tab", { name: /^Invigilators/ }));
    expect(screen.queryByText("Dr. Omar Nabil")).not.toBeInTheDocument();
    expect(screen.getByText("Ahmed Ali")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Everyone/ }));
    fireEvent.change(screen.getByLabelText("Search people"), { target: { value: "phy101" } });
    expect(screen.getByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.queryByText("Dr. Laila Fawzy")).not.toBeInTheDocument();
  });

  it("asks before deleting someone", async () => {
    renderPage();
    const trigger = screen.getByRole("button", { name: "Actions for Dr. Omar Nabil" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(remove).not.toHaveBeenCalled();
    expect(await screen.findByText(/has 9 duties/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("2"));
  });

  it("adds a person with clean values, using the real chief limit in the hint", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByText("Supervises up to 3 rooms at the same time")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add chief invigilator" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Invigilator One room/ }));
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "  Sara   Adel " } });
    fireEvent.change(screen.getByLabelText(/Department/, { selector: "input" }), { target: { value: "Physics" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "Sara@Uni.EDU" } });
    fireEvent.change(screen.getByLabelText("Subjects taught"), { target: { value: "phy101 phy102, phy101" } });
    fireEvent.click(screen.getByRole("radio", { name: "Female" }));
    fireEvent.click(screen.getByRole("button", { name: "Add invigilator" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      name: "Sara Adel", department: "Physics", email: "sara@uni.edu", role: "INVIGILATOR", gender: "FEMALE", subjectCodes: ["PHY101", "PHY102"],
    })));
  });
});
