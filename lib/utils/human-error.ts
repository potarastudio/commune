/**
 * The description line for an error toast.
 *
 * Some of these throws carry copy we wrote for a person to read, like "Keep it
 * under 256 KB." Others carry whatever Postgres, Storage or the network said,
 * which is written for a developer reading a log. Showing the second kind puts
 * words like "violates check constraint" in front of someone who just wanted to
 * change an avatar, and gives them nothing to do about it.
 *
 * So: keep a short, sentence-shaped message, and fall back to a recovery step
 * for anything that reads like machinery.
 */
const TECHNICAL =
  /violates|constraint|JWT|SQLSTATE|ECONN|ETIMEDOUT|fetch failed|null value|permission denied for|does not exist|unexpected token|^\s*[{[]|https?:\/\//i;

export function humanError(err: unknown, fallback = "Try again in a moment."): string {
  const raw = err instanceof Error ? err.message.trim() : "";
  if (!raw || raw.length > 120 || TECHNICAL.test(raw)) return fallback;
  return raw;
}
