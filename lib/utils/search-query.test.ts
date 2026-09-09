import { describe, expect, it } from "vitest";
import { highlightTerms, isEmptySearch, parseSearchQuery } from "./search-query";

describe("parseSearchQuery", () => {
  it("separates operators from free text", () => {
    expect(parseSearchQuery("bluebird hero from:@hakim in:#design after:2026-09-01 before:2026-09-08")).toEqual({
      terms: "bluebird hero",
      from: "hakim",
      in: "design",
      after: "2026-09-01",
      before: "2026-09-08",
    });
  });

  it("accepts operators without @ or # and is case-insensitive", () => {
    const p = parseSearchQuery("FROM:Sari IN:General retro");
    expect(p.from).toBe("sari");
    expect(p.in).toBe("general");
    expect(p.terms).toBe("retro");
  });

  it("keeps invalid dates as plain text", () => {
    const p = parseSearchQuery("invoice before:yesterday");
    expect(p.before).toBeNull();
    expect(p.terms).toBe("invoice before:yesterday");
  });

  it("handles empty input", () => {
    expect(isEmptySearch(parseSearchQuery("   "))).toBe(true);
    expect(isEmptySearch(parseSearchQuery("in:#general"))).toBe(false);
  });
});

describe("highlightTerms", () => {
  it("drops operators, quotes and single letters", () => {
    expect(highlightTerms('"logo lockup" OR sanity -a')).toEqual(["logo", "lockup", "sanity"]);
  });
});
