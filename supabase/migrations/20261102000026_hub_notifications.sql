-- Notifications from Potara Hub, the studio's sales tool, asked for by Hakim
-- on 2026-11-02 (the Hub's spec, section 7).
--
-- The Hub posts each notification to app/api/hub/notify, and Commune sends it
-- to that person as a DM from a "Potara Hub" account, pushed like any DM.
--
-- The account is a service account: an auth user and a profile that never
-- sign in. It has no password, its address is on a reserved domain that can
-- never receive mail or belong to a Google account, it is not on the
-- allowlist, and GoTrue has it banned for good measure. profiles.is_bot marks
-- it, so people lists and mention suggestions can leave it out.
--
-- hub_notifications remembers which message each Hub notification became.
-- The Hub tries again when it gets no answer, so the same id can arrive twice;
-- the second time Commune answers with the first message and posts nothing.

alter table public.profiles add column is_bot boolean not null default false;
comment on column public.profiles.is_bot is
  'A service account (Potara Hub) that posts but never signs in. Left out of people lists and mention suggestions.';

-- ---------------------------------------------------------------------------
-- handle_new_user: service accounts bring their own profile, and are not the
-- first person (who becomes admin). Otherwise unchanged from migration 2.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_email  text := lower(new.email);
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name   text;
  v_base   text;
  v_handle text;
  v_n      int := 0;
  v_role   text;
begin
  -- A service account is created by a migration, which inserts its profile
  -- itself. Only the service role and migrations can write app metadata, so
  -- a sign-up cannot claim this.
  if new.raw_app_meta_data ->> 'commune_bot' = 'true' then
    return new;
  end if;

  if v_email is null or not exists (select 1 from public.allowed_emails ae where ae.email = v_email) then
    raise exception 'Sign-in not allowed: % is not on the Potara allowlist', coalesce(new.email, '<no email>')
      using errcode = 'P0001';
  end if;

  v_name := coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    split_part(v_email, '@', 1)
  );

  -- Derive a unique handle from the email local part: hakim, hakim1, hakim2, ...
  v_base := regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9._-]', '', 'g');
  if v_base !~ '^[a-z0-9]' then
    v_base := 'user' || v_base;
  end if;
  v_base := left(v_base, 24);
  v_handle := v_base;
  while exists (select 1 from public.profiles p where p.handle = v_handle) loop
    v_n := v_n + 1;
    v_handle := v_base || v_n::text;
  end loop;

  -- Bootstrap: the very first person becomes admin; everyone after is a member.
  -- Service accounts exist from the start, so they do not count.
  v_role := case when exists (select 1 from public.profiles p where not p.is_bot) then 'member' else 'admin' end;

  insert into public.profiles (id, email, display_name, handle, avatar_url, role)
  values (
    new.id,
    v_email,
    left(v_name, 80),
    v_handle,
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', '')),
    v_role
  );

  insert into public.channel_members (channel_id, user_id)
  select c.id, new.id from public.channels c where c.name = 'general'
  on conflict do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: is_bot joins the columns nobody can change through the API.
-- Otherwise unchanged from migration 2.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null for service-role / migrations, which are trusted.
  if auth.uid() is not null then
    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is managed by the identity provider' using errcode = '42501';
    end if;
    if new.id <> old.id or new.created_at <> old.created_at or new.is_bot <> old.is_bot then
      raise exception 'Immutable column' using errcode = '42501';
    end if;
  end if;
  new.handle := lower(new.handle);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Potara Hub account. Fixed id, so every environment has the same one.
-- The token columns are '' rather than null, as in seed.sql: GoTrue cannot
-- read a user whose token columns are null, and listing users would fail.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'potara-hub@commune.invalid', null, now(),
        '{"provider":"email","providers":["email"],"commune_bot":true}', '{"full_name":"Potara Hub"}',
        '9999-12-31', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, email, display_name, handle, title, is_bot, email_digest, onboarded_at)
values ('b0000000-0000-4000-8000-000000000001', 'potara-hub@commune.invalid', 'Potara Hub', 'potara-hub',
        'Notifications from hub.potarastudio.com', true, false, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The DM for a set of people, shared by get_or_create_conversation (as the
-- signed-in user) and post_hub_notification (as the Potara Hub account), so
-- both find the same conversation. Service role only: it takes anyone's id.
-- ---------------------------------------------------------------------------
create or replace function public.find_or_create_conversation(p_user_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[];
  v_id  uuid;
begin
  select array_agg(distinct u order by u)
  into v_ids
  from unnest(p_user_ids) as u
  where u is not null;

  if array_length(v_ids, 1) > 8 then
    raise exception 'Group DMs are limited to 8 people' using errcode = 'P0001';
  end if;
  if (select count(*) from public.profiles p where p.id = any (v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Unknown user' using errcode = 'P0002';
  end if;

  -- Serialise concurrent creation for the same member set.
  perform pg_advisory_xact_lock(hashtext(array_to_string(v_ids, ',')));

  select cm.conversation_id
  into v_id
  from public.conversation_members cm
  group by cm.conversation_id
  having array_agg(cm.user_id order by cm.user_id) = v_ids
  limit 1;

  if v_id is null then
    insert into public.conversations default values returning id into v_id;
    insert into public.conversation_members (conversation_id, user_id)
    select v_id, unnest(v_ids);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.find_or_create_conversation(uuid[]) from public, anon, authenticated;

create or replace function public.get_or_create_conversation(user_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return public.find_or_create_conversation(array_append(coalesce(user_ids, '{}'::uuid[]), v_me));
end;
$$;

-- ---------------------------------------------------------------------------
-- Which message each Hub notification became. Service-role only, like
-- desktop_handoffs: RLS on and no policies, so the API sees nothing.
-- ---------------------------------------------------------------------------
create table public.hub_notifications (
  id         uuid primary key,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.hub_notifications is 'Potara Hub notification id → the DM it was posted as (app/api/hub/notify).';
comment on column public.hub_notifications.id is 'The Hub''s notification id, its idempotency key.';

alter table public.hub_notifications enable row level security;
revoke all on public.hub_notifications from public, anon, authenticated;

-- Post one Hub notification to the member with that email, as a DM from the
-- Potara Hub account, once. Returns the message and whether this call posted
-- it: an id seen before returns its first message and posts nothing, and a
-- retry that arrives while the first try is still posting waits for it.
-- Returns no row when no member has that email. Service role only.
create or replace function public.post_hub_notification(
  p_id uuid,
  p_recipient_email text,
  p_content jsonb,
  p_content_text text
)
returns table (message_id uuid, posted boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_hub          constant uuid := 'b0000000-0000-4000-8000-000000000001';
  v_recipient    uuid;
  v_conversation uuid;
  v_message      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('hub_notifications'), hashtext(p_id::text));

  select n.message_id into v_message from public.hub_notifications n where n.id = p_id;
  if found then
    return query select v_message, false;
    return;
  end if;

  select p.id into v_recipient
  from public.profiles p
  where p.email = lower(btrim(p_recipient_email)) and not p.is_bot;
  if v_recipient is null then
    return;
  end if;

  v_conversation := public.find_or_create_conversation(array[v_hub, v_recipient]);

  -- clock_timestamp(), not now(): a conversation created just above has the
  -- recipient read up to now(), and the message must come after that to be unread.
  insert into public.messages (conversation_id, author_id, content, content_text, created_at)
  values (v_conversation, v_hub, p_content, p_content_text, clock_timestamp())
  returning id into v_message;

  insert into public.hub_notifications (id, message_id) values (p_id, v_message);

  return query select v_message, true;
end;
$$;

revoke execute on function public.post_hub_notification(uuid, text, jsonb, text) from public, anon, authenticated;
