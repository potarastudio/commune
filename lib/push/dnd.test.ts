import { describe, expect, it } from "vitest";
import { inDoNotDisturb } from "./dnd";

const jakarta = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 9, h - 7, m)); // WIB = UTC+7

describe("inDoNotDisturb", () => {
  const overnight = { dnd_start: "22:00:00", dnd_end: "07:00:00", timezone: "Asia/Jakarta" };
  it("is quiet inside an overnight window and loud outside it", () => {
    expect(inDoNotDisturb(overnight, jakarta(23))).toBe(true);
    expect(inDoNotDisturb(overnight, jakarta(3, 30))).toBe(true);
    expect(inDoNotDisturb(overnight, jakarta(6, 59))).toBe(true);
    expect(inDoNotDisturb(overnight, jakarta(7))).toBe(false);
    expect(inDoNotDisturb(overnight, jakarta(12))).toBe(false);
    expect(inDoNotDisturb(overnight, jakarta(21, 59))).toBe(false);
  });
  it("handles same-day windows and uses the profile timezone", () => {
    const lunch = { dnd_start: "12:00", dnd_end: "13:00", timezone: "Asia/Jakarta" };
    expect(inDoNotDisturb(lunch, jakarta(12, 30))).toBe(true);
    expect(inDoNotDisturb(lunch, new Date(Date.UTC(2026, 8, 9, 12, 30)))).toBe(false); // 19:30 in Jakarta
  });
  it("is never quiet without both bounds", () => {
    expect(inDoNotDisturb({ dnd_start: "22:00", dnd_end: null, timezone: "Asia/Jakarta" }, jakarta(23))).toBe(false);
    expect(inDoNotDisturb({ dnd_start: null, dnd_end: null, timezone: "Nowhere/Invalid" })).toBe(false);
  });
});
