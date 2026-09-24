import "server-only";

import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Push to the phone app (mobile/): APNs for iOS, FCM for Android. Web push
 * cannot reach an app's web view, so the app registers a device token
 * (app/api/push/device) and the fan-out in notify.ts sends here as well as to
 * browsers.
 *
 * Both halves are optional, like R2: with no APNs key or no Firebase service
 * account configured, that platform is skipped and nothing else changes.
 */
export type NativePush = { title: string; body: string; url: string; tag: string };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** PEM keys arrive through env vars with their newlines escaped. */
function pem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function config() {
  const env = serverEnv();
  const apns =
    env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY
      ? {
          keyId: env.APNS_KEY_ID,
          teamId: env.APNS_TEAM_ID,
          key: pem(env.APNS_PRIVATE_KEY),
          bundleId: env.APNS_BUNDLE_ID ?? "com.potarastudio.commune",
          host: env.APNS_PRODUCTION === "true" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com",
        }
      : null;
  const fcm =
    env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY
      ? { projectId: env.FCM_PROJECT_ID, clientEmail: env.FCM_CLIENT_EMAIL, key: pem(env.FCM_PRIVATE_KEY) }
      : null;
  return { apns, fcm };
}

// ---- APNs -------------------------------------------------------------------------

/** Apple accepts a provider token for an hour and rejects refreshing it more than every twenty minutes. */
let apnsJwt: { token: string; issuedAt: number } | null = null;

function apnsToken(keyId: string, teamId: string, key: string): string {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now - apnsJwt.issuedAt < 45 * 60) return apnsJwt.token;
  const data = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(JSON.stringify({ iss: teamId, iat: now }))}`;
  const signature = sign("sha256", Buffer.from(data), { key: createPrivateKey(key), dsaEncoding: "ieee-p1363" });
  apnsJwt = { token: `${data}.${b64url(signature)}`, issuedAt: now };
  return apnsJwt.token;
}

/** Sends to each token; returns the ones Apple says are gone. */
async function sendApns(tokens: string[], push: NativePush): Promise<string[]> {
  const apns = config().apns;
  if (!apns || tokens.length === 0) return [];
  const dead: string[] = [];
  const client = connect(apns.host);
  client.on("error", (err) => console.error("apns connection", { message: err.message }));
  const body = JSON.stringify({
    aps: { alert: { title: push.title, body: push.body }, sound: "default", "thread-id": push.tag },
    // Read back by the app's push plugin as notification.data.url.
    url: push.url,
  });
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${apnsToken(apns.keyId, apns.teamId, apns.key)}`,
              "apns-topic": apns.bundleId,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
            });
            let status = 0;
            let text = "";
            req.setEncoding("utf8");
            req.setTimeout(10_000, () => req.close());
            req.on("response", (headers) => {
              status = Number(headers[":status"]);
            });
            req.on("data", (chunk: string) => {
              text += chunk;
            });
            req.on("end", () => {
              if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(text))) dead.push(token);
              else if (status !== 200) console.error("apns", { status, reason: text.slice(0, 200) });
              resolve();
            });
            req.on("error", (err) => {
              console.error("apns", { message: err.message });
              resolve();
            });
            req.end(body);
          }),
      ),
    );
  } finally {
    client.close();
  }
  return dead;
}

// ---- FCM --------------------------------------------------------------------------

let fcmAccess: { token: string; expiresAt: number } | null = null;

/** An OAuth access token for FCM, from the service account's key (a signed JWT exchanged at Google). */
async function fcmAccessToken(clientEmail: string, key: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAccess && fcmAccess.expiresAt - 120 > now) return fcmAccess.token;
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const data = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const assertion = `${data}.${b64url(sign("sha256", Buffer.from(data), createPrivateKey(key)))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

/** Sends to each token; returns the ones Firebase says are gone. */
async function sendFcm(tokens: string[], push: NativePush): Promise<string[]> {
  const fcm = config().fcm;
  if (!fcm || tokens.length === 0) return [];
  const access = await fcmAccessToken(fcm.clientEmail, fcm.key);
  const dead: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: push.title, body: push.body },
              // Read back by the app's push plugin as notification.data.url.
              data: { url: push.url, tag: push.tag },
              android: { priority: "HIGH", notification: { tag: push.tag, sound: "default" } },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return;
        const text = await res.text();
        if (res.status === 404 || /UNREGISTERED|NOT_FOUND/.test(text)) dead.push(token);
        else console.error("fcm", { status: res.status, reason: text.slice(0, 200) });
      } catch (err) {
        console.error("fcm", { message: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  return dead;
}

/** Push to everyone's phones; tokens the services report as gone are forgotten. Never throws. */
export async function deliverNative(userIds: string[], push: NativePush): Promise<void> {
  if (userIds.length === 0) return;
  const { apns, fcm } = config();
  if (!apns && !fcm) return;
  try {
    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin.from("device_tokens").select("token, platform").in("user_id", userIds);
    if (error || !rows?.length) return;
    const ios = rows.filter((r) => r.platform === "ios").map((r) => r.token);
    const android = rows.filter((r) => r.platform === "android").map((r) => r.token);
    const [deadIos, deadAndroid] = await Promise.all([sendApns(ios, push), sendFcm(android, push).catch((err: unknown) => {
      console.error("fcm", { message: err instanceof Error ? err.message : String(err) });
      return [] as string[];
    })]);
    const dead = [...deadIos, ...deadAndroid];
    if (dead.length) await admin.from("device_tokens").delete().in("token", dead);
  } catch (err) {
    console.error("deliverNative", { message: err instanceof Error ? err.message : String(err) });
  }
}
