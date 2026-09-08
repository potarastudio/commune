/**
 * Cursor pagination on (created_at, id) (§7). Never offsets.
 * Cursors are opaque base64url strings so URLs and cache keys stay tidy.
 */
export type Cursor = { createdAt: string; id: string };

export const PAGE_SIZE = 50;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt}|${c.id}`, "utf8").toString("base64url");
}

export function decodeCursor(s: string | null | undefined): Cursor | null {
  if (!s) return null;
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const idx = raw.lastIndexOf("|");
    if (idx <= 0) return null;
    const createdAt = raw.slice(0, idx);
    const id = raw.slice(idx + 1);
    if (Number.isNaN(Date.parse(createdAt)) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** PostgREST `or()` filter for "strictly before this cursor" in (created_at desc, id desc) order. */
export function beforeCursorFilter(c: Cursor): string {
  return `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`;
}

/** The cursor for "load older than these" is the oldest row of an ascending page. */
export function nextCursorFromPage<T extends { created_at: string; id: string }>(
  ascendingRows: T[],
  pageSize = PAGE_SIZE,
): string | null {
  if (ascendingRows.length < pageSize) return null;
  const oldest = ascendingRows[0];
  return encodeCursor({ createdAt: oldest.created_at, id: oldest.id });
}
