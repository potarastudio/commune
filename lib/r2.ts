import "server-only";
import { AwsClient } from "aws4fetch";
import { serverEnv } from "@/lib/env";

/**
 * Cloudflare R2, the home for attachments too large for Supabase Storage.
 *
 * Supabase's Free plan caps every upload at 50 MB. R2 has no such ceiling and
 * charges nothing for downloads, so files above the cap go there instead: the
 * browser uploads straight to the bucket with a presigned PUT, and reads come
 * back through presigned GETs minted only after the row's own RLS check has
 * passed (see lib/actions/attachments.ts). The bucket stays private.
 *
 * R2 speaks S3, so signing is plain SigV4; aws4fetch does it in a few KB where
 * the AWS SDK would add megabytes. Optional: with no R2_* variables set,
 * r2Config() is null and the app behaves exactly as before.
 */
export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

export function r2Config(): R2Config | null {
  const env = serverEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) return null;
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  };
}

/** How long a minted URL stays valid. Uploads get an hour; a large file over a slow line needs it. */
export const R2_URL_TTL_SECONDS = 60 * 60;

function client(cfg: R2Config) {
  return new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
}

/** S3 wants each path segment percent-encoded once and the slashes left alone. */
function objectUrl(cfg: R2Config, key: string): URL {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${encoded}`);
}

/**
 * Query-string signing covers the method, the object path, every query
 * parameter and the host header, and nothing else. The content type the
 * browser sends is stored on the object but not signed: signing it would turn
 * any mismatch into a 403 on a file that took ten minutes to send, and the
 * database row, not the object metadata, is what the app trusts anyway.
 */
async function presign(cfg: R2Config, url: URL, method: "PUT" | "GET"): Promise<string> {
  url.searchParams.set("X-Amz-Expires", String(R2_URL_TTL_SECONDS));
  const signed = await client(cfg).sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

/** A one-hour URL the browser can PUT one object to. */
export function presignR2Put(cfg: R2Config, key: string): Promise<string> {
  return presign(cfg, objectUrl(cfg, key), "PUT");
}

/**
 * A one-hour URL that reads one object. With `download`, the response carries
 * Content-Disposition: attachment so the browser saves it under that name
 * instead of rendering it.
 */
export function presignR2Get(cfg: R2Config, key: string, opts: { download?: string } = {}): Promise<string> {
  const url = objectUrl(cfg, key);
  if (opts.download) {
    const ascii = opts.download.replace(/["\\\r\n]/g, "_");
    url.searchParams.set("response-content-disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
  }
  return presign(cfg, url, "GET");
}
