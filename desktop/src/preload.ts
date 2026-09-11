import { contextBridge, ipcRenderer } from "electron";

/**
 * The only bridge between the page and the shell. Context isolation is on,
 * so the page cannot reach Node or Electron; it gets exactly these calls.
 *
 * The site integrates lightly and only through `window.communeDesktop`, see
 * lib/desktop.ts in the web app: it posts a system notification where a
 * service worker would have, follows a notification click, and tells Settings
 * that notifications come through the app. Everything else the shell needs
 * (the unread count in the title, the theme) it reads from the page itself.
 */
const version = process.argv.find((a) => a.startsWith("--commune-version="))?.slice("--commune-version=".length) ?? "dev";

contextBridge.exposeInMainWorld("communeDesktop", {
  version,
  platform: process.platform,
  /** Open the system-browser sign-in. */
  signIn: () => ipcRenderer.invoke("desktop:sign-in"),
  /** A system notification, shown only when the window is not focused. */
  notify: (payload: { title: string; body: string; url: string; tag?: string }) =>
    ipcRenderer.invoke("desktop:notify", payload) as Promise<boolean>,
  /** The shell asks the page to go somewhere, e.g. after a notification click. Returns the unsubscribe. */
  onNavigate: (cb: (url: string) => void) => {
    const handler = (_event: unknown, url: string) => cb(url);
    ipcRenderer.on("desktop:navigate", handler);
    return () => ipcRenderer.removeListener("desktop:navigate", handler);
  },
});
