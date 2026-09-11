import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  calendarDay,
  daysAgo,
  formatDayLabel,
  formatFullTimestamp,
  formatLongDate,
  formatMessageTime,
  formatShortDate,
  formatWeekdayShort,
  safeTimeZone,
  sameDay,
  shouldGroup,
} from "./time";

/**
 * Every expectation here names its zone, so the suite passes whatever zone
 * the machine running it is in; `TZ=UTC pnpm test` and `TZ=America/Los_Angeles
 * pnpm test` are both part of the check. The runtime's own zone must never
 * leak in: that was the bug (Vercel is UTC, the studio is Jakarta).
 */
const JKT = "Asia/Jakarta"; // UTC+7, no DST
const NYC = "America/New_York"; // UTC-4 in September
const UTC = "UTC";

// Thursday 10 September 2026, 14:07 UTC = 21:07 in Jakarta = 10:07 in New York.
const T = "2026-09-10T14:07:00.000Z";

describe("formatMessageTime", () => {
  it("is the same instant drawn in the viewer's zone, not the machine's", () => {
    expect(formatMessageTime(T, JKT)).toBe("21:07");
    expect(formatMessageTime(T, NYC)).toBe("10:07");
    expect(formatMessageTime(T, UTC)).toBe("14:07");
  });

  it("pads single digits and draws midnight as 00, never 24", () => {
    expect(formatMessageTime("2026-09-10T17:05:00.000Z", JKT)).toBe("00:05");
    expect(formatMessageTime("2026-09-10T01:09:00.000Z", UTC)).toBe("01:09");
  });
});

describe("formatDayLabel", () => {
  // 17:30 UTC on the 10th is 00:30 on the 11th in Jakarta: a new day there, not in UTC.
  const lateUtc = "2026-09-10T17:30:00.000Z";
  const nowJkt = new Date("2026-09-11T02:00:00.000Z"); // 09:00 on the 11th in Jakarta

  it("decides Today and Yesterday by the viewer's calendar", () => {
    expect(formatDayLabel(lateUtc, JKT, nowJkt)).toBe("Today");
    expect(formatDayLabel(lateUtc, UTC, nowJkt)).toBe("Yesterday");
  });

  it("names older days with weekday, day and month, and adds the year only when it differs", () => {
    expect(formatDayLabel("2026-09-03T05:00:00.000Z", JKT, nowJkt)).toBe("Thursday, 3 September");
    expect(formatDayLabel("2025-09-03T05:00:00.000Z", JKT, nowJkt)).toBe("Wednesday, 3 September 2025");
  });
});

describe("formatFullTimestamp", () => {
  it("reads as a sentence, in the viewer's zone", () => {
    expect(formatFullTimestamp(T, JKT)).toBe("Thursday, 10 September 2026 at 21:07");
    expect(formatFullTimestamp(T, NYC)).toBe("Thursday, 10 September 2026 at 10:07");
  });
});

describe("short and long dates", () => {
  const now = new Date(T);
  it('abbreviates September as "Sep", whatever the ICU data says', () => {
    expect(formatShortDate(T, JKT, now)).toBe("10 Sep");
    expect(formatShortDate("2025-09-10T05:00:00.000Z", JKT, now)).toBe("10 Sep 2025");
  });

  it("writes long dates in full", () => {
    expect(formatLongDate(T, JKT)).toBe("10 September 2026");
    // 23:30 UTC on 31 December is already New Year in Jakarta.
    expect(formatLongDate("2025-12-31T23:30:00.000Z", JKT)).toBe("1 January 2026");
    expect(formatLongDate("2025-12-31T23:30:00.000Z", UTC)).toBe("31 December 2025");
  });

  it("gives the weekday of the viewer's date", () => {
    expect(formatWeekdayShort("2026-09-10T17:30:00.000Z", JKT)).toBe("Fri");
    expect(formatWeekdayShort("2026-09-10T17:30:00.000Z", UTC)).toBe("Thu");
  });
});

describe("calendar arithmetic", () => {
  it("counts days by the viewer's calendar", () => {
    const now = new Date("2026-09-11T02:00:00.000Z");
    expect(daysAgo("2026-09-10T17:30:00.000Z", JKT, now)).toBe(0);
    expect(daysAgo("2026-09-10T16:30:00.000Z", JKT, now)).toBe(1); // 23:30 on the 10th in Jakarta
    expect(daysAgo("2026-09-04T02:00:00.000Z", JKT, now)).toBe(7);
  });

  it("sameDay and calendarDay agree", () => {
    expect(sameDay("2026-09-10T16:59:00.000Z", "2026-09-10T17:01:00.000Z", JKT)).toBe(false);
    expect(sameDay("2026-09-10T16:59:00.000Z", "2026-09-10T17:01:00.000Z", UTC)).toBe(true);
    expect(calendarDay("2026-09-10T17:01:00.000Z", JKT) - calendarDay("2026-09-10T16:59:00.000Z", JKT)).toBe(1);
  });
});

describe("shouldGroup", () => {
  const a = { author_id: "u1", created_at: "2026-09-10T16:58:00.000Z" }; // 23:58 in Jakarta
  const b = { author_id: "u1", created_at: "2026-09-10T17:01:00.000Z" }; // 00:01 the next day

  it("groups the same author within five minutes", () => {
    expect(shouldGroup(a, { ...a, created_at: "2026-09-10T17:02:00.000Z" }, UTC)).toBe(true);
    expect(shouldGroup(a, { ...a, created_at: "2026-09-10T17:04:00.000Z" }, UTC)).toBe(false);
    expect(shouldGroup(a, { ...b, author_id: "u2" }, UTC)).toBe(false);
    expect(shouldGroup(undefined, b, UTC)).toBe(false);
  });

  it("never groups across the viewer's midnight, even three minutes apart", () => {
    expect(shouldGroup(a, b, JKT)).toBe(false);
    expect(shouldGroup(a, b, UTC)).toBe(true);
  });
});

describe("safeTimeZone", () => {
  it("keeps a real zone and falls back to Jakarta for anything else", () => {
    expect(safeTimeZone(NYC)).toBe(NYC);
    expect(safeTimeZone("Not/AZone")).toBe(DEFAULT_TIMEZONE);
    expect(safeTimeZone(null)).toBe(DEFAULT_TIMEZONE);
    expect(safeTimeZone("")).toBe(DEFAULT_TIMEZONE);
  });

  it("means a bad zone on a profile draws Jakarta times instead of throwing", () => {
    expect(formatMessageTime(T, "Not/AZone")).toBe("21:07");
  });
});
