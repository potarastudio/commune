import { describe, expect, it } from "vitest";
import { feedTime, listTime, zoneDifference } from "./list-time";

const JKT = "Asia/Jakarta";
// Wednesday 16 September 2026, 15:00 in Jakarta.
const NOW = new Date("2026-09-16T08:00:00.000Z");

describe("listTime", () => {
  it("shows the clock today, in the viewer's zone", () => {
    expect(listTime("2026-09-16T02:12:00.000Z", JKT, NOW)).toBe("09:12");
  });
  it("says Yesterday, then the weekday, then the date", () => {
    expect(listTime("2026-09-15T02:12:00.000Z", JKT, NOW)).toBe("Yesterday");
    expect(listTime("2026-09-14T02:12:00.000Z", JKT, NOW)).toBe("Mon");
    expect(listTime("2026-09-02T02:12:00.000Z", JKT, NOW)).toBe("2 Sep");
  });
  it("decides the day by the viewer's calendar, not UTC's", () => {
    // 17:30 UTC on the 15th is 00:30 on the 16th in Jakarta: today there.
    expect(listTime("2026-09-15T17:30:00.000Z", JKT, NOW)).toBe("00:30");
  });
});

describe("feedTime", () => {
  it("keeps the clock beside the day", () => {
    expect(feedTime("2026-09-16T04:31:00.000Z", JKT, NOW)).toBe("11:31");
    expect(feedTime("2026-09-15T02:40:00.000Z", JKT, NOW)).toBe("Yesterday 09:40");
    expect(feedTime("2026-09-10T07:07:00.000Z", JKT, NOW)).toBe("10 Sep, 14:07");
  });
});

describe("zoneDifference", () => {
  it("says how far their clock is from yours", () => {
    expect(zoneDifference("Asia/Jakarta", "Asia/Jakarta", NOW)).toBe("same time as you");
    expect(zoneDifference("Asia/Jakarta", "Asia/Makassar", NOW)).toBe("1 hour behind you");
    expect(zoneDifference("Asia/Tokyo", "Asia/Jakarta", NOW)).toBe("2 hours ahead of you");
    expect(zoneDifference("Asia/Kolkata", "Asia/Jakarta", NOW)).toBe("1½ hours behind you");
  });
});
