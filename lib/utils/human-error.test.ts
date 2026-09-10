import { describe, expect, it } from "vitest";
import { humanError } from "./human-error";

describe("humanError", () => {
  it("keeps a message written for a person", () => {
    expect(humanError(new Error("Keep it under 256 KB."))).toBe("Keep it under 256 KB.");
    expect(humanError(new Error("Use a PNG, GIF, WebP or JPEG."))).toBe("Use a PNG, GIF, WebP or JPEG.");
  });

  it("replaces database and network text with a recovery step", () => {
    const machine = [
      'new row for relation "profiles" violates check constraint "profiles_handle_check"',
      "JWT expired",
      "fetch failed",
      "null value in column \"email\"",
      "permission denied for table messages",
      '{"code":"23505","details":null}',
      "connect ECONNREFUSED 127.0.0.1:54321",
    ];
    for (const m of machine) {
      expect(humanError(new Error(m))).toBe("Try again in a moment.");
    }
  });

  it("falls back when there is no message at all", () => {
    expect(humanError(undefined)).toBe("Try again in a moment.");
    expect(humanError("a string, not an Error")).toBe("Try again in a moment.");
    expect(humanError(new Error("   "))).toBe("Try again in a moment.");
  });

  it("rejects anything too long to read in a toast", () => {
    expect(humanError(new Error("word ".repeat(40)))).toBe("Try again in a moment.");
  });

  it("uses the caller's fallback", () => {
    expect(humanError(new Error("JWT expired"), "Sign in again.")).toBe("Sign in again.");
  });
});
