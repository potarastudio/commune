import { Fragment, type ReactNode } from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps matches of `terms` in <mark>, case-insensitively. Plain text in, React out. */
export function highlightText(text: string, terms: string[]): ReactNode {
  const clean = terms.filter(Boolean);
  if (clean.length === 0 || !text) return text;
  const re = new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) && i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-[4px] bg-accent-surface px-[3px] font-semibold text-accent-foreground shadow-[inset_0_0_0_1px_var(--accent-surface-border)]"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** A short window of text around the first match, for result snippets. */
export function snippetAround(text: string, terms: string[], radius = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= radius * 2) return clean;
  const lower = clean.toLowerCase();
  const idx = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1;
  if (idx < 0) return `${clean.slice(0, radius * 2)}…`;
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + radius);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}
