import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Who reaches the app without a session. Potara Hub and pg_cron never have
 * one, and the Hub's fetch follows redirects: sent to /login, its POST would
 * come back 200 from the sign-in page and the notification would count as
 * delivered.
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
  vi.doMock("@supabase/ssr", () => ({
    createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  }));
  return import("./middleware");
}

describe("updateSession without a session", () => {
  it("lets Potara Hub and the cron tick through to their routes", async () => {
    const { updateSession } = await load();
    for (const path of ["/api/hub/notify", "/api/cron/digest"]) {
      const response = await updateSession(new NextRequest(`https://commune.potarastudio.com${path}`, { method: "POST" }));
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("sends everyone else to sign in", async () => {
    const { updateSession } = await load();
    const response = await updateSession(new NextRequest("https://commune.potarastudio.com/api/hubbub", { method: "POST" }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
