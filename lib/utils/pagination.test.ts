import { describe, expect, it } from "vitest";
import { beforeCursorFilter, decodeCursor, encodeCursor, nextCursorFromPage } from "./pagination";

const id = "00000000-0000-4000-8000-000000000001";
const createdAt = "2026-09-08T09:12:00.123456+00:00";

describe("cursor encode/decode", () => {
  it("round-trips", () => {
    expect(decodeCursor(encodeCursor({ createdAt, id }))).toEqual({ createdAt, id });
  });
  it("rejects garbage", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("not-base64!")).toBeNull();
    expect(decodeCursor(Buffer.from("nope|also-nope").toString("base64url"))).toBeNull();
  });
});

describe("beforeCursorFilter", () => {
  it("orders by created_at then id so equal timestamps paginate correctly", () => {
    expect(beforeCursorFilter({ createdAt, id })).toBe(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
    );
  });
});

describe("nextCursorFromPage", () => {
  it("returns null when the page is short (no more rows)", () => {
    expect(nextCursorFromPage([{ created_at: createdAt, id }], 50)).toBeNull();
  });
  it("points at the oldest row of a full page", () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      created_at: `2026-09-0${i + 1}T00:00:00+00:00`,
      id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    }));
    expect(decodeCursor(nextCursorFromPage(rows, 3))).toEqual({ createdAt: rows[0].created_at, id: rows[0].id });
  });
});
