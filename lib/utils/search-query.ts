/**
 * Search syntax (§5): free text plus `from:@handle`, `in:#channel`,
 * `before:YYYY-MM-DD`, `after:YYYY-MM-DD`. Unknown `key:value` pairs stay in the text.
 */
export type ParsedSearch = {
  terms: string;
  from: string | null;
  in: string | null;
  before: string | null;
  after: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): string | null {
  if (!DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : value;
}

export function parseSearchQuery(input: string): ParsedSearch {
  const out: ParsedSearch = { terms: "", from: null, in: null, before: null, after: null };
  const words: string[] = [];

  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    const m = /^(from|in|before|after):(.+)$/i.exec(token);
    if (!m) {
      words.push(token);
      continue;
    }
    const key = m[1].toLowerCase();
    const raw = m[2];
    if (key === "from") out.from = raw.replace(/^@/, "").toLowerCase() || null;
    else if (key === "in") out.in = raw.replace(/^#/, "").toLowerCase() || null;
    else if (key === "before") out.before = validDate(raw) ?? out.before;
    else if (key === "after") out.after = validDate(raw) ?? out.after;
    if ((key === "before" || key === "after") && !validDate(raw)) words.push(token);
  }

  out.terms = words.join(" ");
  return out;
}

/** Words to highlight in results: the free-text terms, minus operators and quotes. */
export function highlightTerms(terms: string): string[] {
  return terms
    .replace(/["]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-/, ""))
    .filter((w) => w.length > 1 && !/^(or|and|not)$/i.test(w));
}

export function isEmptySearch(p: ParsedSearch): boolean {
  return p.terms.trim() === "" && !p.from && !p.in && !p.before && !p.after;
}
