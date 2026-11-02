/**
 * Potara Hub, the studio's sales tool. Its notifications arrive as DMs from
 * the Potara Hub account (app/api/hub/notify), each ending in a link back to
 * the Hub. Every Hub page sits behind the Hub's own sign-in.
 */
export const HUB_ORIGIN = "https://hub.potarastudio.com";

/** The link, normalised, when it is a page in Potara Hub; otherwise null. */
export function hubUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== HUB_ORIGIN || url.username || url.password) return null;
  return url.href;
}

export function isHubUrl(raw: string): boolean {
  return hubUrl(raw) !== null;
}
