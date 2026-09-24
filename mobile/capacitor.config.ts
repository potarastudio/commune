/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/splash-screen" />
import type { CapacitorConfig } from "@capacitor/cli";
import type { KeyboardResize } from "@capacitor/keyboard";
// Read through TypeScript 5's transpiler, which the CLI uses to load this file
// (hence typescript ^5 in package.json; TypeScript 7 drops that API).
import pkg from "./package.json";

/**
 * Where the app lives. Like the desktop shell (../desktop), the mobile app is a
 * native window onto the hosted site, never a bundled copy of it: Commune is
 * server-rendered, so the URL that serves the browser serves the app.
 *
 * The URL is baked into the native projects when `cap sync` copies this config
 * across, so it is fixed per build:
 *
 *   pnpm sync                                             production
 *   COMMUNE_MOBILE_URL=http://localhost:3001 pnpm sync    iOS simulator against `pnpm dev`
 *   COMMUNE_MOBILE_URL=http://10.0.2.2:3001 pnpm sync     Android emulator against `pnpm dev`
 */
const APP_URL = process.env.COMMUNE_MOBILE_URL ?? "https://commune.potarastudio.com";

/**
 * How the site recognises the app, as it recognises `CommuneDesktop/<version>`
 * on the desktop. Appended to the platform's own user agent.
 */
const USER_AGENT = `CommuneMobile/${pkg.version}`;

const config: CapacitorConfig = {
  appId: "com.potarastudio.commune",
  appName: "Commune",
  // Capacitor will not start without a local index.html, even with server.url
  // set. It is never shown in normal use; see www/index.html.
  webDir: "www",
  server: {
    url: APP_URL,
    // Plain http only for a dev server; production is https.
    cleartext: APP_URL.startsWith("http://"),
    // The app's own host stays in the window. Every other top-level navigation
    // (Google sign-in included) opens in the system browser.
    allowNavigation: [new URL(APP_URL).hostname],
  },
  ios: {
    appendUserAgent: USER_AGENT,
    // The page pads itself with env(safe-area-inset-*) under viewport-fit=cover.
    contentInset: "never",
    // The page scrolls its own containers; the document itself must not bounce.
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
    // No backgroundColor: MainViewController paints the page's own light or
    // dark ground, which a single config colour cannot.
  },
  android: {
    appendUserAgent: USER_AGENT,
  },
  plugins: {
    // iOS only. Android resizes through adjustResize on MainActivity, and
    // Capacitor's SystemBars pads the WebView for the keyboard; leave
    // `resizeOnFullScreen` unset, which SystemBars warns against.
    Keyboard: {
      resize: "native" as KeyboardResize,
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
