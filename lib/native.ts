"use client";

/**
 * The iOS and Android apps (mobile/, a Capacitor shell around this site) put
 * one object on the page: `window.Capacitor`, with the native plugins on
 * `Capacitor.Plugins`. In a browser it is absent and every helper here does
 * nothing, so the rest of the app never has to ask which it is running in.
 *
 * The plugins are called through that global rather than the npm packages:
 * the shell injects them into the hosted page, and the web bundle stays free
 * of native code it would only ever use inside the app. Every call is guarded,
 * because an older installed app may not have a plugin a newer site expects.
 */

type Listener = { remove: () => Promise<void> | void };
type Plugin = Record<string, ((...args: unknown[]) => Promise<unknown>) | undefined> & {
  addListener?: (event: string, cb: (payload: never) => void) => Promise<Listener> | Listener;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, Plugin | undefined>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const c = window.Capacitor;
  return c?.isNativePlatform?.() ? c : null;
}

function plugin(name: string): Plugin | null {
  return capacitor()?.Plugins?.[name] ?? null;
}

/** Calls a plugin method, swallowing a missing plugin or a native error. */
async function call<T = unknown>(name: string, method: string, arg?: unknown): Promise<T | null> {
  const fn = plugin(name)?.[method];
  if (!fn) return null;
  try {
    return (await fn(arg)) as T;
  } catch (err) {
    console.warn(`native ${name}.${method}`, err);
    return null;
  }
}

/** Subscribes to a plugin event; returns the remover, a no-op outside the app. */
function listen<T>(name: string, event: string, cb: (payload: T) => void): () => void {
  const add = plugin(name)?.addListener;
  if (!add) return () => {};
  let handle: Listener | null = null;
  let removed = false;
  void Promise.resolve(add.call(plugin(name), event, cb as (payload: never) => void)).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    void handle?.remove();
  };
}

export function isNativeApp(): boolean {
  return capacitor() !== null;
}

export function nativePlatform(): "ios" | "android" | null {
  const p = capacitor()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : null;
}

export const native = {
  /** Android's back button and back gesture. The handler decides; the OS does nothing by itself once one is set. */
  onBackButton(cb: () => void): () => void {
    return listen("App", "backButton", cb);
  },

  /** Leaves the app to the home screen, the way Back behaves at the root of an Android app. */
  minimize(): void {
    void call("App", "minimizeApp");
  },

  /** The `commune://…` link that launched the app from cold, if one did. */
  async launchUrl(): Promise<string | null> {
    const r = await call<{ url?: string }>("App", "getLaunchUrl");
    return r?.url ?? null;
  },

  /** A `commune://…` link opened the app. */
  onAppUrlOpen(cb: (url: string) => void): () => void {
    return listen<{ url: string }>("App", "appUrlOpen", (e) => cb(e.url));
  },

  /** The app came back to the foreground or went away. */
  onAppStateChange(cb: (active: boolean) => void): () => void {
    return listen<{ isActive: boolean }>("App", "appStateChange", (e) => cb(e.isActive));
  },

  /** iOS: the edge swipe that walks back through the WebView's history (mobile/ ios CommuneNav plugin). */
  setSwipeBack(enabled: boolean): void {
    if (nativePlatform() !== "ios") return;
    void call("CommuneNav", "setSwipeBackEnabled", { enabled });
  },

  /** The system browser, as a sheet over the app: Google refuses to sign in inside a WebView. */
  openBrowser(url: string): void {
    void call("Browser", "open", { url, presentationStyle: "popover" });
  },

  closeBrowser(): void {
    void call("Browser", "close");
  },

  /** A light tap under the finger: long-press, a swipe that commits, a pull that refreshes. */
  haptic(style: "light" | "medium" = "light"): void {
    void call("Haptics", "impact", { style: style === "medium" ? "MEDIUM" : "LIGHT" });
  },

  /** Status bar text colour for the current theme. `dark` means a dark page, so light text. */
  setStatusBar(darkPage: boolean): void {
    void call("StatusBar", "setStyle", { style: darkPage ? "DARK" : "LIGHT" });
  },

  /** The on-screen keyboard showing or hiding, so the composer can drop the home-indicator inset. */
  onKeyboard(cb: (open: boolean) => void): () => void {
    const off1 = listen("Keyboard", "keyboardWillShow", () => cb(true));
    const off2 = listen("Keyboard", "keyboardWillHide", () => cb(false));
    return () => {
      off1();
      off2();
    };
  },

  push: {
    /** Current permission: "granted", "denied", or "prompt" when the OS has not asked yet. */
    async permission(): Promise<"granted" | "denied" | "prompt" | null> {
      const r = await call<{ receive: string }>("PushNotifications", "checkPermissions");
      if (!r) return null;
      return r.receive === "granted" ? "granted" : r.receive === "denied" ? "denied" : "prompt";
    },
    /** Shows the OS prompt when it has not been answered; resolves to the answer. */
    async request(): Promise<"granted" | "denied" | "prompt" | null> {
      const r = await call<{ receive: string }>("PushNotifications", "requestPermissions");
      if (!r) return null;
      return r.receive === "granted" ? "granted" : r.receive === "denied" ? "denied" : "prompt";
    },
    register(): void {
      void call("PushNotifications", "register");
    },
    onToken(cb: (token: string) => void): () => void {
      return listen<{ value: string }>("PushNotifications", "registration", (e) => cb(e.value));
    },
    onError(cb: (message: string) => void): () => void {
      return listen<{ error?: string }>("PushNotifications", "registrationError", (e) => cb(e.error ?? "Registration failed."));
    },
    /** A notification was tapped; its data carries the URL to open. */
    onOpen(cb: (url: string | null) => void): () => void {
      return listen<{ notification?: { data?: { url?: string } } }>("PushNotifications", "pushNotificationActionPerformed", (e) =>
        cb(e.notification?.data?.url ?? null),
      );
    },
  },
};
