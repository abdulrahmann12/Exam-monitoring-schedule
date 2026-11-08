import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { GUIDE_SECTIONS, USER_GUIDE_PDF } from "@/content/userGuide";

import UserGuide from "./UserGuide";

vi.mock("@/components/uniguard/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe("user guides page", () => {
  it("lists the contents with links into the reading view, plus read and download buttons", () => {
    render(<MemoryRouter><UserGuide /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Uni-Guard User Guide" })).toBeInTheDocument();
    GUIDE_SECTIONS.forEach((section) =>
      expect(screen.getByRole("link", { name: new RegExp(section.title) })).toHaveAttribute("href", `/user-guide/read#${section.id}`));
    expect(screen.getByRole("link", { name: /Read online/ })).toHaveAttribute("href", "/user-guide/read");
    expect(screen.getByRole("link", { name: /Download PDF/ })).toHaveAttribute("href", USER_GUIDE_PDF);
  });
});
