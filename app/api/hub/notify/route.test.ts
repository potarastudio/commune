import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route against stand-ins for the database and push. Its answers are the
 * contract Potara Hub is built against (the Hub's spec, section 7, and its
 * src/lib/notifications/commune.ts), so these pin them down.
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
const SECRET = "0123456789abcdef".repeat(4);
const SENT = {
  id: "00000000-0000-4000-8000-000000002001",
  recipientEmail: "Int.BD@potarastudio.com",
  title: "Lead baru belum direspon",
  body: "E2E Klien Satu · website",
  url: "https://hub.potarastudio.com/leads/00000000-0000-4000-8000-000000002002",
};
/** The only error text the Hub logs (its outbound.ts, errorCode). */
const HUB_CODE = /^[a-z][a-z0-9_]{0,63}$/;

const rpc = vi.fn();
const notifyForMessage = vi.fn();
let afterTasks: (() => unknown)[] = [];

async function load(env: Record<string, string> = { HUB_WEBHOOK_SECRET: SECRET }) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doMock("server-only", () => ({}));
  vi.doMock("@/lib/supabase/admin", () => ({
    createSupabaseAdminClient: () => ({ rpc: (fn: string, args: unknown) => ({ maybeSingle: () => rpc(fn, args) }) }),
  }));
  vi.doMock("@/lib/push/notify", () => ({ notifyForMessage }));
  vi.doMock("next/server", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/server")>()),
    after: (task: () => unknown) => void afterTasks.push(task),
  }));
  for (const [k, v] of Object.entries({ ...ENV, ...env })) vi.stubEnv(k, v);
  return import("./route");
}

function post(body: unknown, authorization: string | null = `Bearer ${SECRET}`) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== null) headers.set("Authorization", authorization);
  return new NextRequest("https://commune.potarastudio.com/api/hub/notify", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, error: string) {
  expect(response.status).toBe(status);
  const json = await response.json();
  expect(json).toEqual({ error });
  expect(json.error).toMatch(HUB_CODE);
}

beforeEach(() => {
  rpc.mockReset();
  notifyForMessage.mockReset();
  afterTasks = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/hub/notify", () => {
  it("answers 503 while HUB_WEBHOOK_SECRET is not set, and touches nothing", async () => {
    const { POST } = await load({});
    await expectError(await POST(post(SENT)), 503, "not_configured");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 401 without the secret, before reading the body", async () => {
    const { POST } = await load();
    await expectError(await POST(post(SENT, null)), 401, "unauthorized");
    await expectError(await POST(post(SENT, `Bearer ${SECRET.slice(0, -1)}x`)), 401, "unauthorized");
    await expectError(await POST(post(SENT, `Bearer ${SECRET}0`)), 401, "unauthorized");
    await expectError(await POST(post(SENT, SECRET)), 401, "unauthorized");
    await expectError(await POST(post("{not json", "Bearer wrong")), 401, "unauthorized");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON, is missing parts, or links outside the Hub", async () => {
    const { POST } = await load();
    await expectError(await POST(post("{not json")), 400, "invalid_json");
    await expectError(await POST(post({ ...SENT, title: "" })), 400, "invalid_body");
    await expectError(await POST(post({ ...SENT, id: "notification-1" })), 400, "invalid_body");
    await expectError(await POST(post({ ...SENT, url: "https://evil.example/leads/1" })), 400, "invalid_url");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("posts the DM and answers 201 with its id, then pushes it after answering", async () => {
    rpc.mockResolvedValue({ data: { message_id: "m-1", posted: true }, error: null });
    const { POST } = await load();
    const response = await POST(post(SENT));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ messageId: "m-1" });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("post_hub_notification");
    expect(args).toMatchObject({ p_id: SENT.id, p_recipient_email: "int.bd@potarastudio.com" });
    expect(args.p_content_text).toBe(`${SENT.title}\n${SENT.body}\nBuka di Hub`);
    expect(JSON.stringify(args.p_content)).toContain(SENT.url);

    expect(notifyForMessage).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]();
    expect(notifyForMessage).toHaveBeenCalledWith("m-1");
  });

  it("answers 200 with the first message when that id was already posted, and pushes nothing", async () => {
    rpc.mockResolvedValue({ data: { message_id: "m-1", posted: false }, error: null });
    const { POST } = await load();
    const response = await POST(post(SENT));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messageId: "m-1" });
    expect(afterTasks).toHaveLength(0);
  });

  it("answers 404 unknown_recipient when no member has that email", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { POST } = await load();
    await expectError(await POST(post(SENT)), 404, "unknown_recipient");
    expect(afterTasks).toHaveLength(0);
  });

  it("answers 500 when the database fails, which the Hub tries again", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "canceling statement due to statement timeout" } });
    const { POST } = await load();
    await expectError(await POST(post(SENT)), 500, "post_failed");
    rpc.mockRejectedValue(new TypeError("fetch failed"));
    await expectError(await POST(post(SENT)), 500, "post_failed");
  });
});
