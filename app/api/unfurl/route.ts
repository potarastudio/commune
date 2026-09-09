import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOpenGraph } from "@/lib/utils/opengraph";

/**
 * Link unfurling (§5 Phase 2). Fetches OpenGraph data server-side and caches
 * it per URL in link_previews. Only signed-in members may trigger a fetch, the
 * target must be public http(s) (no private ranges), and the body is capped.
 */
export const runtime = "nodejs";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 60 * 60 * 1000;
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 6000;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function isPublicHost(hostname: string): Promise<boolean> {
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (isIP(hostname)) return !privateIp(hostname);
  try {
    const addrs = await lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  void reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.byteLength, total - offset)), offset);
    offset += c.byteLength;
    if (offset >= total) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function GET(request: NextRequest) {
  const parsed = z.string().url().max(2000).safeParse(request.nextUrl.searchParams.get("url"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  const target = new URL(parsed.data);
  if (target.protocol !== "http:" && target.protocol !== "https:") return NextResponse.json({ error: "Only http(s) links." }, { status: 400 });
  target.hash = "";
  const url = target.toString();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: cached } = await admin.from("link_previews").select("*").eq("url", url).maybeSingle();
  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if ((cached.ok && age < FRESH_MS) || (!cached.ok && age < RETRY_FAILED_MS)) {
      return NextResponse.json(cached, { headers: { "Cache-Control": "private, max-age=3600" } });
    }
  }

  const row = { url, ok: false as boolean, title: null as string | null, description: null as string | null, image_url: null as string | null, site_name: null as string | null, fetched_at: new Date().toISOString() };

  if (await isPublicHost(target.hostname)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CommuneBot/1.0; +https://potarastudio.com)", Accept: "text/html,application/xhtml+xml" },
      });
      clearTimeout(timer);
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && /text\/html|application\/xhtml/.test(type)) {
        const og = parseOpenGraph(await readCapped(res), res.url || url);
        Object.assign(row, og, { ok: Boolean(og.title || og.description) });
      }
    } catch (err) {
      console.warn("unfurl fetch failed", { url, message: err instanceof Error ? err.message : String(err) });
    }
  }

  await admin.from("link_previews").upsert(row, { onConflict: "url" });
  return NextResponse.json(row, { headers: { "Cache-Control": "private, max-age=3600" } });
}
