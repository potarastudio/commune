import { describe, expect, it } from "vitest";
import { fileKind, formatBytes, isImageMime, safeFileName } from "./files";

describe("formatBytes", () => {
  it("picks sensible units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatBytes(null)).toBe("");
  });
});

describe("safeFileName", () => {
  it("strips path separators and control characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("..-..-etc-passwd");
    expect(safeFileName("badname.png")).toBe("badname.png");
  });
  it("keeps readable names and caps length", () => {
    expect(safeFileName("Bluebird hero (v3).png")).toBe("Bluebird hero (v3).png");
    expect(safeFileName("a".repeat(200) + ".png")).toHaveLength(120);
    expect(safeFileName("   ")).toBe("file");
  });
});

describe("kinds", () => {
  it("classifies mime types", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/svg+xml")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(fileKind("application/pdf", "x.pdf")).toBe("pdf");
    expect(fileKind("application/octet-stream", "design.zip")).toBe("archive");
    expect(fileKind("text/csv", "data.csv")).toBe("text");
    expect(fileKind(null, "mystery")).toBe("file");
  });
});
