import type { UnreadMap } from "./unreads";

/** One sidebar destination in display order. `key` matches the unread map. */
export type NavItem = { href: string; key: string };

/**
 * Alt+↑/↓ walks the sidebar in display order; Alt+Shift+↑/↓ walks only
 * unread ones. Wraps at the ends. When the current page is not in the list
 * (Activity, Search…), ↓ starts at the top and ↑ at the bottom.
 */
export function nextItem(items: NavItem[], currentHref: string, dir: 1 | -1, unreads?: UnreadMap): NavItem | null {
  const pool = unreads ? items.filter((i) => (unreads[i.key]?.unread ?? 0) > 0) : items;
  if (pool.length === 0) return null;
  const current = pool.findIndex((i) => i.href === currentHref);
  if (current === -1) {
    // Not in the pool: pick the nearest in overall order, so unread-walking feels local.
    const all = items.findIndex((i) => i.href === currentHref);
    if (all === -1) return dir === 1 ? pool[0] : pool[pool.length - 1];
    const ahead = dir === 1 ? items.slice(all + 1) : items.slice(0, all).reverse();
    return ahead.find((i) => pool.includes(i)) ?? (dir === 1 ? pool[0] : pool[pool.length - 1]);
  }
  return pool[(current + dir + pool.length) % pool.length];
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** True when the keystroke happened somewhere that owns its own keys. */
export function inEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(".tiptap, input, textarea, select, [contenteditable='true']"));
}
