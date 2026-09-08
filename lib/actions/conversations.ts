"use server";

import { z } from "zod";
import { getOrCreateConversation } from "@/lib/queries/conversations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true; id: string } | { ok: false; error: string };

/** Opens (or reuses) a DM/group DM with these people; the caller is always included. */
export async function startConversationAction(input: { userIds: string[] }): Promise<Result> {
  const parsed = z.object({ userIds: z.array(z.string().uuid()).min(1).max(7) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick between 1 and 7 people." };
  try {
    const supabase = await createSupabaseServerClient();
    const id = await getOrCreateConversation(supabase, parsed.data.userIds);
    return { ok: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("startConversationAction", { message });
    return { ok: false, error: /limited to 8/.test(message) ? "Group messages are limited to 8 people." : "Couldn't start that conversation. Try again." };
  }
}
