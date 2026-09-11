-- The desktop app gets its own session instead of a copy of the browser's.
--
-- Migration 20 parked the browser's refresh token and handed it to the app,
-- so both clients shared one session. Supabase rotates a session's refresh
-- token on every refresh and treats a token that comes back two rotations
-- late as reuse ("refresh_token_already_used", logged as a possible abuse
-- attempt). With the browser refreshing and the app idle, the app fell
-- behind and was signed out; the next handoff then carried a token that was
-- already dead.
--
-- The handoff now parks a one-time sign-in token minted for the user
-- (admin generateLink), and the app verifies it into a session of its own.
-- The column is renamed to say what it holds, and any rows parked under the
-- old scheme are discarded: they are useless now and expire within minutes
-- anyway.

delete from public.desktop_handoffs;

alter table public.desktop_handoffs rename column refresh_token to token_hash;

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
    returning token_hash into v_token;
  return v_token;
end;
$$;

revoke execute on function public.claim_desktop_handoff(uuid) from public, anon, authenticated;
