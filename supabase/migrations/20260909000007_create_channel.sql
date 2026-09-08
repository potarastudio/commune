-- create_channel(): creates a channel and joins the creator in one step.
-- A plain INSERT ... RETURNING by a member fails RLS for private channels,
-- because the SELECT policy is checked before the auto-join trigger runs.
create or replace function public.create_channel(
  p_name text,
  p_description text default null,
  p_is_private boolean default false
)
returns public.channels
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_channel public.channels%rowtype;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_name !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Channel names use lowercase letters, numbers and dashes (max 40).' using errcode = '22023';
  end if;
  if exists (select 1 from public.channels c where c.name = v_name) then
    raise exception 'A channel called #% already exists.', v_name using errcode = '23505';
  end if;

  insert into public.channels (name, description, is_private, created_by)
  values (v_name, nullif(btrim(p_description), ''), coalesce(p_is_private, false), v_me)
  returning * into v_channel;

  insert into public.channel_members (channel_id, user_id)
  values (v_channel.id, v_me)
  on conflict do nothing;

  return v_channel;
end;
$$;

revoke execute on function public.create_channel(text, text, boolean) from public, anon;
