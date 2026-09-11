import { describe, expect, it } from "vitest";
import { fileKind, formatBytes, isImageMime, safeFileName, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_LABEL, MAX_LARGE_ATTACHMENT_BYTES, MAX_LARGE_ATTACHMENT_LABEL, providerFor, attachmentLimitBytes, largeUploadsEnabled } from "./files";

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

describe("attachment limit", () => {
  it("is 50 MB, the Free-plan ceiling, and the label agrees", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(52428800);
    expect(MAX_ATTACHMENT_LABEL).toBe("50 MB");
  });
});

describe("large attachments", () => {
  it("is 1 GB, matching the column constraint, with a clean label", () => {
    expect(MAX_LARGE_ATTACHMENT_BYTES).toBe(1073741824);
    expect(MAX_LARGE_ATTACHMENT_LABEL).toBe("1 GB");
  });

  it("routes a file by size: at the Supabase cap stays, one byte over goes to R2", () => {
    expect(providerFor(52428800)).toBe("supabase");
    expect(providerFor(52428801)).toBe("r2");
    expect(providerFor(0)).toBe("supabase");
  });

  it("the accepted limit follows the build flag", () => {
    const prev = process.env.NEXT_PUBLIC_LARGE_UPLOADS;
    process.env.NEXT_PUBLIC_LARGE_UPLOADS = "";
    expect(largeUploadsEnabled()).toBe(false);
    expect(attachmentLimitBytes()).toBe(52428800);
    process.env.NEXT_PUBLIC_LARGE_UPLOADS = "1";
    expect(attachmentLimitBytes()).toBe(1073741824);
    process.env.NEXT_PUBLIC_LARGE_UPLOADS = prev;
  });
});
