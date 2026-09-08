/** Validates server env at boot (§7). Fails fast on a misconfigured deploy. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("./lib/env");
    serverEnv();
  }
}
