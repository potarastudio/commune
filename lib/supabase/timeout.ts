/** How long a server-side Supabase call may take before it is abandoned. */
export const SUPABASE_TIMEOUT_MS = 15_000;

/**
 * `fetch` with a deadline, for the Supabase clients that run on the server.
 *
 * fetch has no timeout of its own, so when Supabase stops answering (its data
 * API did, for days, in October 2026) every request waits until the platform
 * kills the function, minutes later, and each of those minutes is billed. Past
 * the deadline the call fails like any other network error instead: queries
 * come back with an `error`, and `auth.getUser()` with no user.
 *
 * The slowest thing these clients ask for is a query, which Postgres itself
 * cancels after 8 seconds for a signed-in user, so 15 seconds never cuts off
 * an answer that was coming. Browser clients keep the plain fetch: nobody is
 * billed for a tab that waits.
 */
export function fetchWithTimeout(ms: number = SUPABASE_TIMEOUT_MS): typeof fetch {
  const late = () => new DOMException(`No answer from Supabase within ${ms} ms`, "TimeoutError");

  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    // Reads are abandoned, not aborted. During a server render React answers
    // identical GETs with one request (a layout and its page both asking who
    // is signed in), but only for a fetch that carries no signal; hand it one
    // and every caller goes to the network, which measured ten extra requests
    // on a channel page (56 against 46). So the caller stops waiting and the
    // request is left to die on its own.
    if ((method === "GET" || method === "HEAD") && !init?.signal) {
      const request = fetch(input, init);
      request.catch(() => {}); // an abandoned request fails later, with nobody listening
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          request,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(late()), ms);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }

    // Writes, and anything the caller can already cancel, are cancelled for real.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(late()), ms);
    const outer = init?.signal;
    const forward = () => controller.abort(outer?.reason);
    if (outer?.aborted) forward();
    else outer?.addEventListener("abort", forward, { once: true });
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forward);
    }
  };
}
