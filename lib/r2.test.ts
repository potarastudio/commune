import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The bucket is not reachable from a unit test, so this checks the part that
 * is ours: that a presigned URL points at the right object on the right
 * account, carries the expiry, signs the content type, and that reads for
 * downloads ask for a saved-as name.
 */
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "k",
  LIVEKIT_API_SECRET: "s",
  RESEND_API_KEY: "r",
  VAPID_PUBLIC_KEY: "p",
  VAPID_PRIVATE_KEY: "q",
};
const R2 = { R2_ACCOUNT_ID: "acct123", R2_ACCESS_KEY_ID: "AKIDEXAMPLE", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "commune-attachments" };

async function load(extra: Record<string, string> = {}) {
  vi.resetModules();
  vi.doMock("server-only", () => ({}));
  for (const [k, v] of Object.entries({ ...ENV, ...extra })) vi.stubEnv(k, v);
  return import("./r2");
}

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("r2Config", () => {
  it("is null until every R2 variable is set", async () => {
    const r2 = await load();
    expect(r2.r2Config()).toBeNull();
    const partial = await load({ R2_ACCOUNT_ID: "a", R2_BUCKET: "b" });
    expect(partial.r2Config()).toBeNull();
  });

  it("reads the four variables", async () => {
    const r2 = await load(R2);
    expect(r2.r2Config()).toEqual({ accountId: "acct123", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret", bucket: "commune-attachments" });
  });
});

describe("presigned URLs", () => {
  it("PUT: the object under the caller's folder, one hour, host-only signed headers", async () => {
    const r2 = await load(R2);
    const url = new URL(await r2.presignR2Put(r2.r2Config()!, "user-1/abc/hero v4 (final).png"));
    expect(url.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/commune-attachments/user-1/abc/hero%20v4%20(final).png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request$/);
    // Query signing binds the host only; the browser may send any content type.
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("GET for display carries no disposition; GET for download does", async () => {
    const r2 = await load(R2);
    const cfg = r2.r2Config()!;
    const view = new URL(await r2.presignR2Get(cfg, "user-1/abc/deck.pdf"));
    expect(view.searchParams.has("response-content-disposition")).toBe(false);
    const dl = new URL(await r2.presignR2Get(cfg, "user-1/abc/deck.pdf", { download: 'Deck "v2".pdf' }));
    const disp = dl.searchParams.get("response-content-disposition") ?? "";
    expect(disp).toMatch(/^attachment; filename="Deck _v2_.pdf"/);
    expect(disp).toContain("filename*=UTF-8''Deck%20%22v2%22.pdf");
    expect(dl.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two different keys never share a signature", async () => {
    const r2 = await load(R2);
    const cfg = r2.r2Config()!;
    const a = new URL(await r2.presignR2Get(cfg, "user-1/a/x.bin"));
    const b = new URL(await r2.presignR2Get(cfg, "user-1/b/x.bin"));
    expect(a.searchParams.get("X-Amz-Signature")).not.toBe(b.searchParams.get("X-Amz-Signature"));
  });
});
