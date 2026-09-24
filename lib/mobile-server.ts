import "server-only";
import { headers } from "next/headers";
import { isNativeAppUserAgent, isPhoneUserAgent } from "@/lib/mobile";

/** True when this request comes from a phone, so the page renders the mobile interface. */
export async function isMobileRequest(): Promise<boolean> {
  return isPhoneUserAgent((await headers()).get("user-agent"));
}

/** True when this request comes from the Commune iOS or Android app. */
export async function isNativeAppRequest(): Promise<boolean> {
  return isNativeAppUserAgent((await headers()).get("user-agent"));
}
