import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The phone app's push registration (see supabase/migrations/…_device_tokens).
 * The app gets a token from APNs or FCM and posts it here; notify.ts sends to
 * it alongside web push.
 */
const tokenSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().min(8).max(4096),
  appVersion: z.string().max(40).optional(),
});

async function signedInUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** POST: this phone's token, for the signed-in member. A token already filed under another account moves here. */
export async function POST(request: NextRequest) {
  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid device token." }, { status: 400 });
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  // The service role, because the row may belong to whoever used this phone before.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("device_tokens").upsert(
    {
      user_id: user.id,
      platform: parsed.data.platform,
      token: parsed.data.token,
      app_version: parsed.data.appVersion ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) {
    console.error("device token save", { message: error.message });
    return NextResponse.json({ error: "Couldn't turn on notifications for this phone." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE: stop sending to this phone. */
export async function DELETE(request: NextRequest) {
  const parsed = z.object({ token: z.string().min(8).max(4096) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid device token." }, { status: 400 });
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("device_tokens").delete().eq("token", parsed.data.token).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't turn off notifications for this phone." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
