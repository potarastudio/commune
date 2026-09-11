import fs from "node:fs";
import path from "node:path";

/**
 * Where the app lives. The desktop build is a window onto the hosted site,
 * never a bundled copy of it, because Commune is server-rendered: the same
 * URL that serves the browser serves this window.
 *
 * COMMUNE_DEV=1 points at the local dev server so the shell can be worked on
 * without touching production.
 */
export const IS_DEV = Boolean(process.env.COMMUNE_DEV);
export const APP_ORIGIN = IS_DEV ? "http://localhost:3001" : "https://commune.potarastudio.com";

/** The custom scheme the browser hands sign-in back through. */
export const PROTOCOL = "commune";

/** What a navigation may stay inside the window for. Everything else opens in the browser. */
export const ALLOWED_ORIGINS = new Set([APP_ORIGIN]);

/** The sign-in page, told to finish on the handoff route instead of in the browser. */
export const HANDOFF_PATH = "/desktop/handoff";
export const LOGIN_PATH = `/login?next=${encodeURIComponent(HANDOFF_PATH)}`;

/**
 * The shell's own version. app.getVersion() reports Electron's version when
 * running from source, so read package.json directly; it is inside the asar
 * in a packaged build and one level up in dev.
 */
export const VERSION: string = (() => {
  try {
    return (JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
})();

/** Files shipped beside the app: badge and tray images. */
export function resourcePath(rel: string): string {
  const base = process.resourcesPath && !IS_DEV ? process.resourcesPath : path.join(__dirname, "..", "build");
  return path.join(base, rel);
}
