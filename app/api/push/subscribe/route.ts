import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** GET: the VAPID public key the browser needs to subscribe. */
export async function GET() {
  return NextResponse.json({ publicKey: serverEnv().VAPID_PUBLIC_KEY });
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().max(500).optional(),
});

/** POST: store this browser's push subscription for the signed-in user. */
export async function POST(request: NextRequest) {
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      user_agent: parsed.data.userAgent ?? request.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("push subscribe", { message: error.message });
    return NextResponse.json({ error: "Couldn't save the subscription." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE: remove this browser's subscription. */
export async function DELETE(request: NextRequest) {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't remove the subscription." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
