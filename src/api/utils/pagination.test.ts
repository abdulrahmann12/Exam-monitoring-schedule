import { describe, expect, it } from "vitest";

import { fetchAllPaginatedItems, withoutRepeats } from "./pagination";

describe("loading every page", () => {
  it("keeps one copy of a row that arrived on two pages", async () => {
    // Page 1 and page 2 both returned "b" (rows changed order between the two requests).
    const pages = [[{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]];
    const result = await fetchAllPaginatedItems({ page: 0, size: 2 }, async (params) => ({
      items: pages[params.page ?? 0], page: params.page ?? 0, size: 2, totalItems: 4, totalPages: 2,
    }));
    expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps items without an id", () => {
    expect(withoutRepeats([{ id: 1 }, { id: 1 }, { name: "x" }, { name: "x" }])).toEqual([{ id: 1 }, { name: "x" }, { name: "x" }]);
  });
});
