import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signaturePositions } from "@/lib/uniguard/exporters";

import Settings from "./Settings";

const save = vi.fn().mockResolvedValue({});
const permissions = vi.hoisted(() => ({ canEditSettings: true, canManageUsers: true }));

const settings = {
  id: "s", systemName: "Uni-Guard Schedules", appTagline: "Exam Invigilation Planning", logoUrl: null, theme: "LIGHT",
  universityName: "Cairo University", department: "Engineering", examPeriod: "Fall", maxDutiesPerDay: 0, maxDutiesPerPeriod: 0,
  minRestMinutes: 0, studentsPerInvigilator: 30, chiefMaxParallelRooms: 2, documentSignatures: [],
};

vi.mock("@/hooks", () => ({
  useSettingsQuery: () => ({ isLoading: false, isError: false, data: settings }),
  useUpdateSettingsMutation: () => ({ mutateAsync: save, isPending: false }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => permissions }));
vi.mock("@/hooks/useDemoUser", () => ({ useDemoUser: () => false }));
vi.mock("@/state/scheduleGroup", () => ({ useScheduleGroup: () => ({ activeGroup: { name: "Fall 2026" } }) }));
vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/uniguard/ChangePasswordCard", () => ({ ChangePasswordCard: () => <p>password card</p> }));
vi.mock("@/components/uniguard/TwoFactorCard", () => ({ TwoFactorCard: () => <p>two-step card</p> }));
vi.mock("@/components/uniguard/ConnectedAccountsCard", () => ({ ConnectedAccountsCard: () => null }));
vi.mock("@/components/uniguard/UniversitySsoCard", () => ({ UniversitySsoCard: () => <p>sso card</p> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage(path = "/settings") {
  return render(<MemoryRouter initialEntries={[path]}><Settings /></MemoryRouter>);
}

describe("settings", () => {
  beforeEach(() => {
    permissions.canEditSettings = true;
    permissions.canManageUsers = true;
    save.mockClear();
  });

  it("adds footer signatures, previews them and saves only after the save bar is used", async () => {
    renderPage();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add signature/ }));
    fireEvent.change(screen.getByLabelText("Signature 1 title"), { target: { value: "Head of Schedules Committee" } });
    fireEvent.change(screen.getByLabelText("Signature 1 name"), { target: { value: "Dr. Laila Fawzy" } });
    fireEvent.click(screen.getByRole("button", { name: /Add signature/ }));
    fireEvent.change(screen.getByLabelText("Signature 2 name"), { target: { value: "Prof. Omar" } });

    expect(screen.getByText("Each signature needs a title.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Signature 2 title"), { target: { value: "University Vice President" } });

    // The preview shows the footer as it will be printed.
    expect(screen.getAllByText("Head of Schedules Committee").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      documentSignatures: [
        { title: "Head of Schedules Committee", name: "Dr. Laila Fawzy" },
        { title: "University Vice President", name: "Prof. Omar" },
      ],
      theme: "LIGHT",
      examPeriod: "Fall",
    })));
  });

  it("explains each scheduling rule with an example", () => {
    renderPage("/settings?section=rules");
    expect(screen.getByText(/A room with 75 students needs at least 3 invigilators/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Minimum break between two sessions (minutes)"), { target: { value: "30" } });
    expect(screen.getByText(/starts at 11:30 at the earliest/)).toBeInTheDocument();
  });

  it("shows people without settings rights only their own account", () => {
    permissions.canEditSettings = false;
    permissions.canManageUsers = false;
    renderPage("/settings?section=university");
    expect(screen.queryByRole("button", { name: /University/ })).not.toBeInTheDocument();
    expect(screen.getByText("password card")).toBeInTheDocument();
  });

  it("places 1 to 4 signatures across the PDF footer", () => {
    expect(signaturePositions(0, 40, 800)).toEqual([]);
    expect(signaturePositions(1, 40, 800)).toEqual([{ x: 40, align: "left" }]);
    expect(signaturePositions(2, 40, 800).map((position) => position.align)).toEqual(["left", "right"]);
    expect(signaturePositions(3, 40, 800)).toEqual([{ x: 40, align: "left" }, { x: 420, align: "center" }, { x: 800, align: "right" }]);
  });
});
