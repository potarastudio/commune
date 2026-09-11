"use client";

/**
 * The desktop app (desktop/, an Electron shell around this site) exposes one
 * object on the page. In a browser it is absent and every helper here is a
 * no-op, so nothing else in the app has to think about which it is running in.
 *
 * Kept deliberately small. The shell reads what it can from the page itself
 * (the unread count in the title); the page only reaches out for the two
 * things a browser tab cannot do: a system notification while the window is
 * hidden, and following a click on one.
 */
export type DesktopBridge = {
  version: string;
  platform: string;
  signIn(): Promise<void>;
  notify(payload: { title: string; body: string; url: string; tag?: string }): Promise<boolean>;
  onNavigate(cb: (url: string) => void): () => void;
};

declare global {
  interface Window {
    communeDesktop?: DesktopBridge;
  }
}

export function desktopBridge(): DesktopBridge | null {
  return typeof window !== "undefined" && window.communeDesktop ? window.communeDesktop : null;
}

export function isDesktopApp(): boolean {
  return desktopBridge() !== null;
}
