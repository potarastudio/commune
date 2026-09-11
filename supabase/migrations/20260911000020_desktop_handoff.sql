-- Desktop sign-in handoff.
--
-- The desktop app signs people in through the system browser and receives the
-- session back over a commune:// link. A refresh token on its own is not
-- single-use: GoTrue keeps a rotated token exchangeable within its reuse
-- family, so the raw token cannot be the link. Instead the handoff route
-- stores the token here under a random id with a short expiry, the link
-- carries only that id, and the exchange route deletes the row as it reads
-- it. A link therefore works exactly once and only for a couple of minutes.
--
-- Service-role only. The two routes use the admin client; no user can read
-- or write this table through the API.

create table public.desktop_handoffs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '2 minutes'
);

alter table public.desktop_handoffs enable row level security;
-- No policies on purpose: with RLS on and no policy, anon and authenticated
-- see nothing. The service role bypasses RLS.
revoke all on public.desktop_handoffs from public, anon, authenticated;

-- Claim a handoff: return the token exactly once, then it is gone. Expired
-- rows are swept on the way through so nothing accumulates.
create or replace function public.claim_desktop_handoff(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  delete from public.desktop_handoffs where expires_at < now();
  delete from public.desktop_handoffs
    where id = p_id and expires_at >= now()
    returning refresh_token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.claim_desktop_handoff(uuid) from public, anon, authenticated;
