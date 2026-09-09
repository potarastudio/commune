"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Admin: promote or demote a member. The last admin cannot demote themselves. */
export async function setRoleAction(input: { userId: string; role: "admin" | "member" }): Promise<Result> {
  const parsed = z.object({ userId: z.string().uuid(), role: z.enum(["admin", "member"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't read that." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Only admins can change roles." };

  if (parsed.data.role === "member") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { ok: false, error: "Commune needs at least one admin. Make someone else an admin first." };
  }

  const { error } = await supabase.from("profiles").update({ role: parsed.data.role }).eq("id", parsed.data.userId);
  if (error) {
    console.error("setRoleAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't change that role. Try again." };
  }
  revalidatePath("/settings");
  return { ok: true };
}
