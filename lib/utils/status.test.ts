import { describe, expect, it } from "vitest";
import { isStatusActive, localTimeLabel, statusExpiresAt } from "./status";

// 2026-09-09 03:10 UTC = 10:10 Wednesday in Jakarta.
const now = new Date("2026-09-09T03:10:00.000Z");

describe("isStatusActive", () => {
  it("needs an emoji or text", () => {
    expect(isStatusActive({ status_emoji: null, status_text: null, status_expires_at: null })).toBe(false);
    expect(isStatusActive({ status_emoji: "🎧", status_text: null, status_expires_at: null })).toBe(true);
  });

  it("expires", () => {
    const soon = new Date(now.getTime() + 60_000).toISOString();
    const past = new Date(now.getTime() - 60_000).toISOString();
    expect(isStatusActive({ status_emoji: null, status_text: "Lunch", status_expires_at: soon }, now)).toBe(true);
    expect(isStatusActive({ status_emoji: null, status_text: "Lunch", status_expires_at: past }, now)).toBe(false);
  });
});

describe("statusExpiresAt", () => {
  it("handles relative choices", () => {
    expect(statusExpiresAt("never", now)).toBeNull();
    expect(statusExpiresAt("30m", now)).toBe("2026-09-09T03:40:00.000Z");
    expect(statusExpiresAt("4h", now)).toBe("2026-09-09T07:10:00.000Z");
  });

  it("ends today at local midnight", () => {
    // Jakarta midnight after 2026-09-09 is 2026-09-09T17:00Z.
    expect(statusExpiresAt("today", now, "Asia/Jakarta")).toBe("2026-09-09T17:00:00.000Z");
  });

  it("ends the week on Sunday midnight local", () => {
    // Wednesday → 4 days after tonight's midnight.
    expect(statusExpiresAt("week", now, "Asia/Jakarta")).toBe("2026-09-13T17:00:00.000Z");
  });
});

describe("localTimeLabel", () => {
  it("shows the other person's clock only across zones", () => {
    expect(localTimeLabel("Asia/Jakarta", "Asia/Jakarta", now)).toBeNull();
    expect(localTimeLabel("Europe/London", "Asia/Jakarta", now)).toBe("04:10");
  });
});
