import { describe, expect, it } from "vitest";
import { nextItem } from "./shortcuts";

const items = [
  { href: "/channel/a", key: "channel:a" },
  { href: "/channel/b", key: "channel:b" },
  { href: "/channel/c", key: "channel:c" },
  { href: "/dm/d", key: "conversation:d" },
];

describe("nextItem", () => {
  it("walks the sidebar in order and wraps", () => {
    expect(nextItem(items, "/channel/a", 1)?.href).toBe("/channel/b");
    expect(nextItem(items, "/dm/d", 1)?.href).toBe("/channel/a");
    expect(nextItem(items, "/channel/a", -1)?.href).toBe("/dm/d");
  });

  it("starts at the ends when the current page is not a channel", () => {
    expect(nextItem(items, "/activity", 1)?.href).toBe("/channel/a");
    expect(nextItem(items, "/activity", -1)?.href).toBe("/dm/d");
  });

  it("walks only unread items when an unread map is given", () => {
    const unreads = { "channel:c": { unread: 2, has_mention: false }, "conversation:d": { unread: 1, has_mention: true } };
    expect(nextItem(items, "/channel/a", 1, unreads)?.href).toBe("/channel/c");
    expect(nextItem(items, "/channel/c", 1, unreads)?.href).toBe("/dm/d");
    expect(nextItem(items, "/dm/d", 1, unreads)?.href).toBe("/channel/c");
    expect(nextItem(items, "/channel/b", -1, unreads)?.href).toBe("/dm/d");
  });

  it("returns null when nothing is unread", () => {
    expect(nextItem(items, "/channel/a", 1, {})).toBeNull();
  });
});
