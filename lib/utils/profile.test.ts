import { describe, expect, it } from "vitest";
import { handleProblem, normaliseHandle } from "./profile";

describe("normaliseHandle", () => {
  it("lowercases, replaces spaces and strips junk", () => {
    expect(normaliseHandle("Hakim Haiman")).toBe("hakim-haiman");
    expect(normaliseHandle("__Sari!!")).toBe("sari");
    expect(normaliseHandle("raka.p")).toBe("raka.p");
  });
  it("caps at 30 characters", () => {
    expect(normaliseHandle("a".repeat(40))).toHaveLength(30);
  });
});

describe("handleProblem", () => {
  it("accepts valid handles", () => {
    expect(handleProblem("hakim")).toBeNull();
    expect(handleProblem("h4k1m.h-2_")).toBeNull();
  });
  it("rejects empty, bad start, bad chars and reserved words", () => {
    expect(handleProblem("")).toMatch(/Pick/);
    expect(handleProblem("-x")).toMatch(/Start/);
    expect(handleProblem("Hakim")).toMatch(/lowercase/);
    expect(handleProblem("channel")).toMatch(/reserved/);
  });
});
