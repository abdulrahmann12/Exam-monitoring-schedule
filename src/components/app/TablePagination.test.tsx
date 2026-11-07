import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchAllPaginatedItems } from "@/api/utils/pagination";

import { pageNumbers, pageOf, TablePagination } from "./TablePagination";

describe("table pagination", () => {
  it("shows a short list of page numbers with gaps", () => {
    expect(pageNumbers(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(pageNumbers(5, 12)).toEqual([0, "…", 4, 5, 6, "…", 11]);
    expect(pageNumbers(0, 12)).toEqual([0, 1, "…", 11]);
  });

  it("cuts one page and never shows an empty page after the list got shorter", () => {
    const items = Array.from({ length: 62 }, (_, index) => index);
    expect(pageOf(items, 2, 25)).toEqual(items.slice(50, 62));
    expect(pageOf(items.slice(0, 10), 2, 25)).toEqual(items.slice(0, 10));
  });

  it("tells where you are and moves between pages", () => {
    const onPageChange = vi.fn();
    render(<TablePagination page={1} pageSize={25} total={62} noun="people" onPageChange={onPageChange} onPageSizeChange={vi.fn()} />);
    expect(screen.getByText("26–50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });
});

describe("loading every page", () => {
  it("asks the server for every page, so long lists are never cut off", async () => {
    const fetchPage = vi.fn(async ({ page }: { page?: number; size?: number }) => ({
      items: Array.from({ length: page === 2 ? 50 : 100 }, (_, index) => `${page}-${index}`),
      page: page ?? 0, size: 100, totalItems: 250, totalPages: 3,
    }));
    const all = await fetchAllPaginatedItems({ page: 0, size: 100 }, fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(all.items).toHaveLength(250);
  });
});
