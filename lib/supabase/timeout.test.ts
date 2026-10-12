import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./timeout";

const ENDPOINT = "https://db.example/rest/v1/channels";

/** A server that answers at once, with its calls typed like fetch's. */
const answering = (answer: Response) => vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => answer);

/** A server that never answers: like the real fetch, the promise settles only once its signal aborts. */
function hangingFetch() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) reject(signal.reason);
      else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchWithTimeout", () => {
  it("stops waiting for a read that never answers", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const started = Date.now();
    await expect(fetchWithTimeout(40)(ENDPOINT)).rejects.toMatchObject({ name: "TimeoutError" });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("sends a read with no signal, so React can still share one request between callers", async () => {
    const answer = new Response("[]", { status: 200 });
    const inner = answering(answer);
    vi.stubGlobal("fetch", inner);
    const headers = { apikey: "k" };
    await expect(fetchWithTimeout(1000)(ENDPOINT, { headers })).resolves.toBe(answer);
    await expect(fetchWithTimeout(1000)(ENDPOINT, { method: "HEAD" })).resolves.toBe(answer);
    await expect(fetchWithTimeout(1000)(ENDPOINT)).resolves.toBe(answer);
    expect(inner.mock.calls[0][1]).toEqual({ headers });
    for (const [, init] of inner.mock.calls) expect(init?.signal).toBeUndefined();
  });

  it("cancels a write that never answers", async () => {
    const inner = hangingFetch();
    vi.stubGlobal("fetch", inner);
    await expect(fetchWithTimeout(40)(ENDPOINT, { method: "POST", body: "{}" })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(inner.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("hands back a write's answer untouched", async () => {
    const answer = new Response("{}", { status: 201 });
    const inner = answering(answer);
    vi.stubGlobal("fetch", inner);
    await expect(fetchWithTimeout(1000)(ENDPOINT, { method: "post", body: "{}" })).resolves.toBe(answer);
    expect(inner).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ method: "post", body: "{}", signal: expect.any(AbortSignal) }));
  });

  it("still lets the caller cancel, reads included", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const caller = new AbortController();
    const pending = fetchWithTimeout(60_000)(ENDPOINT, { signal: caller.signal });
    caller.abort(new Error("changed my mind"));
    await expect(pending).rejects.toThrow("changed my mind");
  });

  it("does not wait on a request the caller already cancelled", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const caller = new AbortController();
    caller.abort(new Error("too late"));
    await expect(fetchWithTimeout(60_000)(ENDPOINT, { method: "POST", signal: caller.signal })).rejects.toThrow("too late");
  });
});
