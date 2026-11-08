import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GUIDE_SECTIONS } from "@/content/userGuide";

import { MemoryRouter } from "react-router-dom";
import { USER_GUIDE_PDF } from "@/content/userGuide";

import UserGuideRead from "./UserGuideRead";

const renderPage = () => render(<MemoryRouter><UserGuideRead /></MemoryRouter>);

vi.mock("@/components/uniguard/AppLayout", () => ({
  AppLayout: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => <div>{actions}{children}</div>,
}));

describe("user guide reading view", () => {
  it("shows every section and a PDF download", () => {
    renderPage();
    GUIDE_SECTIONS.forEach((section) => expect(screen.getByRole("heading", { level: 2, name: new RegExp(section.title) })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Download PDF/ })).toHaveAttribute("href", USER_GUIDE_PDF);
  });

  it("filters sections by search words", () => {
    renderPage();
    fireEvent.change(screen.getAllByLabelText("Search the guide")[0], { target: { value: "tenant id" } });
    expect(screen.getByRole("heading", { level: 2, name: /Settings/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /Dashboard/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText("Search the guide")[0], { target: { value: "zzzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("only uses screenshots that exist in public/guide", async () => {
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sources = GUIDE_SECTIONS.flatMap((section) => section.blocks.flatMap((block) => block.kind === "img" ? [block.src] : []));
    expect(sources.length).toBeGreaterThan(20);
    sources.forEach((src) => expect(existsSync(resolve(process.cwd(), "public", src.slice(1)))).toBe(true));
  });
});
