import { describe, expect, it } from "vitest";
import { emojiNameFromFile, emojiNameProblem, mayContainShortcode, shortcodeName, splitShortcodes } from "./custom-emoji";

describe("custom emoji names", () => {
  it("derives a safe name from a file name", () => {
    expect(emojiNameFromFile("Party Parrot.GIF")).toBe("party_parrot");
    expect(emojiNameFromFile("--Blob Wave--.png")).toBe("blob_wave");
    expect(emojiNameFromFile("x".repeat(40) + ".png")).toHaveLength(32);
  });

  it("validates names", () => {
    expect(emojiNameProblem("")).toBe("Give it a name.");
    expect(emojiNameProblem("Party")).toContain("lowercase");
    expect(emojiNameProblem("party_parrot")).toBeNull();
  });

  it("recognises shortcodes but not unicode emoji", () => {
    expect(shortcodeName(":party_parrot:")).toBe("party_parrot");
    expect(shortcodeName("🔥")).toBeNull();
    expect(shortcodeName(":Nope:")).toBeNull();
  });
});

describe("splitShortcodes", () => {
  const known = (n: string) => n === "parrot";

  it("replaces only known names", () => {
    expect(splitShortcodes("go :parrot: go :unknown: end", known)).toEqual([
      { kind: "text", value: "go " },
      { kind: "emoji", name: "parrot", raw: ":parrot:" },
      { kind: "text", value: " go :unknown: end" },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitShortcodes("12:30: lunch", known)).toEqual([{ kind: "text", value: "12:30: lunch" }]);
    expect(mayContainShortcode("12:30 lunch")).toBe(false);
    expect(mayContainShortcode("see :parrot:")).toBe(true);
  });
});
