"use client";

/** Browser side of web push: register the worker, subscribe with the server's VAPID key, store it. */

import { isDesktopApp } from "@/lib/desktop";
import { isNativeApp, native, nativePlatform } from "@/lib/native";

/*
 * Inside the phone app web push cannot reach the web view; the app registers
 * with APNs or FCM instead and the token is filed with the server
 * (app/api/push/device). The token this phone registered is remembered here,
 * so "on" survives a reload and "off" knows what to remove.
 */
const NATIVE_TOKEN_KEY = "commune-native-push-token";

function storedNativeToken(): string | null {
  try {
    return window.localStorage.getItem(NATIVE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeNativeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(NATIVE_TOKEN_KEY, token);
    else window.localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch {
    // The token is also on the server; this only remembers the switch.
  }
}

/** Asks the OS for this phone's push token; resolves once APNs or FCM hands it over. */
function nativeToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      offToken();
      offError();
    };
    const offToken = native.push.onToken((token) => {
      done();
      resolve(token);
    });
    const offError = native.push.onError((message) => {
      done();
      reject(new Error(message));
    });
    const timer = setTimeout(() => {
      done();
      reject(new Error("The phone didn't hand over a push token. Try again in a moment."));
    }, 15_000);
    native.push.register();
  });
}

async function fileNativeToken(token: string): Promise<void> {
  const platform = nativePlatform();
  if (!platform) throw new Error("Push is only available in the Commune app.");
  const res = await fetch("/api/push/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, token, appVersion: /CommuneMobile\/([\w.]+)/.exec(navigator.userAgent)?.[1] }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't turn on notifications.");
  storeNativeToken(token);
}

/**
 * On each launch of the app: if push was on, ask for the token again and file
 * it if it changed. APNs and FCM rotate tokens, and a stale one simply stops
 * arriving. Quiet on failure; Settings shows the real state.
 */
export async function refreshNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  const stored = storedNativeToken();
  if (!stored || (await native.push.permission()) !== "granted") return;
  try {
    const token = await nativeToken();
    if (token !== stored) await fileNativeToken(token);
  } catch (err) {
    console.warn("push refresh", err);
  }
}

/** "desktop": the app delivers notifications itself; there is nothing to subscribe. */
export type PushState = "unsupported" | "denied" | "off" | "on" | "desktop";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

function toUint8(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function getPushState(): Promise<PushState> {
  if (isDesktopApp()) return "desktop";
  if (isNativeApp()) {
    const permission = await native.push.permission();
    if (permission === null) return "unsupported";
    if (permission === "denied") return "denied";
    return permission === "granted" && storedNativeToken() ? "on" : "off";
  }
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  if (isDesktopApp()) return "desktop";
  if (isNativeApp()) {
    const permission = await native.push.request();
    if (permission === null) return "unsupported";
    if (permission !== "granted") return permission === "denied" ? "denied" : "off";
    await fileNativeToken(await nativeToken());
    return "on";
  }
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const res = await fetch("/api/push/subscribe");
  const { publicKey } = (await res.json()) as { publicKey: string };
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8(publicKey) as BufferSource,
    }));

  const json = sub.toJSON();
  const save = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
  });
  if (!save.ok) throw new Error("Couldn't save the subscription.");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (isDesktopApp()) return "desktop";
  if (isNativeApp()) {
    const token = storedNativeToken();
    if (token) {
      await fetch("/api/push/device", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }
    storeNativeToken(null);
    return "off";
  }
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
  return "off";
}
