import { describe, expect, it } from "vitest";

import { slugFromName } from "./slug";

describe("short code suggested from the university name", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugFromName("Cairo University")).toBe("cairo-university");
    expect(slugFromName("  King Saud Univ. (Riyadh) ")).toBe("king-saud-univ-riyadh");
  });

  it("drops characters that are not allowed and stays within 60 characters", () => {
    expect(slugFromName("جامعة القاهرة")).toBe("");
    expect(slugFromName("A".repeat(80)).length).toBeLessThanOrEqual(60);
    expect(slugFromName("x-".repeat(40))).not.toMatch(/-$/);
  });
});
