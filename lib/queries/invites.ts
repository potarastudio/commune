import type { SupabaseServerClient } from "@/lib/supabase/server";

export type InviteRow = {
  email: string;
  created_at: string;
  invited_by: { display_name: string } | null;
  /** Set once the person has signed in. */
  profile: { id: string; display_name: string; handle: string; avatar_url: string | null; role: string } | null;
};

/** Allowlist with sign-in status. RLS makes this admin-only (§4). */
export async function getInvites(supabase: SupabaseServerClient): Promise<InviteRow[]> {
  const [{ data: allowed, error }, { data: profiles, error: pErr }] = await Promise.all([
    supabase
      .from("allowed_emails")
      .select("email, created_at, invited_by:profiles!allowed_emails_invited_by_fkey(display_name)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name, handle, avatar_url, role"),
  ]);
  if (error) throw new Error(error.message);
  if (pErr) throw new Error(pErr.message);

  const byEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));
  return allowed.map((a) => {
    const p = byEmail.get(a.email.toLowerCase());
    return {
      email: a.email,
      created_at: a.created_at,
      invited_by: (a.invited_by as unknown as { display_name: string } | null) ?? null,
      profile: p ? { id: p.id, display_name: p.display_name, handle: p.handle, avatar_url: p.avatar_url, role: p.role } : null,
    };
  });
}
