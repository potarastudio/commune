"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * GoTrue reports a bad or used magic link in the URL fragment
 * (#error_code=otp_expired…), which the server never sees. Promote it to the
 * query string so the page can show the right message.
 */
export function HashError() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("error")) return;
    const params = new URLSearchParams(hash.slice(1));
    const code = params.get("error_code") ?? "";
    const reason = /otp_expired|invalid|access_denied/i.test(code) ? "link" : "oauth";
    router.replace(`/login?error=${reason}`);
  }, [router]);
  return null;
}
