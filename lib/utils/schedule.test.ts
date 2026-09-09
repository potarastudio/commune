import { describe, expect, it } from "vitest";
import { atLocalTime, describeWhen, fromLocalInput, reminderPresets, sendLaterPresets } from "./schedule";

// Wednesday 2026-09-09 10:10 in Jakarta (UTC+7).
const now = new Date("2026-09-09T03:10:00.000Z");

describe("atLocalTime", () => {
  it("resolves a local wall-clock time to an instant", () => {
    expect(atLocalTime(now, "Asia/Jakarta", 1, 9).toISOString()).toBe("2026-09-10T02:00:00.000Z");
    expect(atLocalTime(now, "Europe/London", 0, 14).toISOString()).toBe("2026-09-09T13:00:00.000Z"); // BST
  });
});

describe("presets", () => {
  it("send later: tomorrow and next Monday at 09:00 local", () => {
    const p = sendLaterPresets(now, "Asia/Jakarta");
    expect(p.map((x) => x.id)).toEqual(["1h", "tomorrow", "monday"]);
    expect(p[1].at.toISOString()).toBe("2026-09-10T02:00:00.000Z");
    expect(p[2].at.toISOString()).toBe("2026-09-14T02:00:00.000Z");
  });

  it("reminders: offers this afternoon only in the morning", () => {
    expect(reminderPresets(now, "Asia/Jakarta").some((x) => x.id === "today")).toBe(true);
    const evening = new Date("2026-09-09T12:00:00.000Z"); // 19:00 Jakarta
    expect(reminderPresets(evening, "Asia/Jakarta").some((x) => x.id === "today")).toBe(false);
  });
});

describe("describeWhen", () => {
  it("uses Today / Tomorrow / weekday", () => {
    expect(describeWhen("2026-09-09T08:20:00.000Z", "Asia/Jakarta", now)).toBe("Today at 15:20");
    expect(describeWhen("2026-09-10T02:00:00.000Z", "Asia/Jakarta", now)).toBe("Tomorrow at 09:00");
    expect(describeWhen("2026-09-14T02:00:00.000Z", "Asia/Jakarta", now)).toBe("Mon 14 Sep at 09:00");
  });
});

describe("fromLocalInput", () => {
  it("interprets the input in the user's zone", () => {
    expect(fromLocalInput("2026-09-10T09:00", "Asia/Jakarta")?.toISOString()).toBe("2026-09-10T02:00:00.000Z");
    expect(fromLocalInput("nope", "Asia/Jakarta")).toBeNull();
  });
});
