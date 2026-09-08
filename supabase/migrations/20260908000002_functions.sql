-- Commune: functions and triggers
-- Helpers used by RLS (security definer to avoid recursive policy checks),
-- sign-up allowlist trigger, conversation dedupe, message insert path,
-- thread counters, #general protections, search and unread helpers.

-- ---------------------------------------------------------------------------
-- Authorisation helpers (security definer, stable, locked search_path)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.channel_members cm
    where cm.channel_id = p_channel_id and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()
  );
$$;

-- Public channels are browsable before joining (like Slack); private ones need membership.
create or replace function public.can_read_channel(p_channel_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.channels c
    where c.id = p_channel_id
      and (not c.is_private or public.is_channel_member(c.id))
  );
$$;

-- Shared by table policies and storage policies.
create or replace function public.can_read_message(p_message_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and (
        (m.channel_id is not null and public.can_read_channel(m.channel_id))
        or (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
      )
  );
$$;

-- Member of the message's container (required to react, pin, reply).
create or replace function public.can_write_message(p_message_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and (
        (m.channel_id is not null and public.is_channel_member(m.channel_id))
        or (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: allowlist enforcement + profile creation + auto-join #general
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

  -- Bootstrap: the very first account becomes admin; everyone after is a member.
  v_role := case when exists (select 1 from public.profiles) then 'member' else 'admin' end;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- profiles: only admins may change roles; email is owned by auth
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
    if new.id <> old.id or new.created_at <> old.created_at then
      raise exception 'Immutable column' using errcode = '42501';
    end if;
  end if;
  new.handle := lower(new.handle);
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard_update();

-- ---------------------------------------------------------------------------
-- #general: everyone is a member, nobody can leave, archive, rename or privatise it
-- ---------------------------------------------------------------------------
create or replace function public.channels_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.name = 'general' then
      raise exception '#general cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.name = 'general' and (new.name <> 'general' or new.is_archived or new.is_private) then
    raise exception '#general cannot be renamed, archived or made private' using errcode = '42501';
  end if;
  if new.id <> old.id or new.created_at <> old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Immutable column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger channels_guard
  before update or delete on public.channels
  for each row execute function public.channels_guard();

create or replace function public.channel_members_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.channels c where c.id = old.channel_id and c.name = 'general') then
      raise exception 'You cannot leave #general' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.channel_id <> old.channel_id or new.user_id <> old.user_id or new.joined_at <> old.joined_at then
    raise exception 'Immutable column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger channel_members_guard
  before update or delete on public.channel_members
  for each row execute function public.channel_members_guard();

-- New public channels: creator joins automatically.
create or replace function public.channels_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.channel_members (channel_id, user_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger channels_after_insert
  after insert on public.channels
  for each row execute function public.channels_after_insert();

-- ---------------------------------------------------------------------------
-- messages: thread replies inherit the parent's container; immutable columns;
-- edit flags; reply counters on the parent
-- ---------------------------------------------------------------------------
create or replace function public.messages_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_parent public.messages%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.messages where id = new.parent_id;
    if not found then
      raise exception 'Parent message not found' using errcode = 'P0002';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Cannot reply to a thread reply; reply to the top-level message' using errcode = 'P0001';
    end if;
    new.channel_id := v_parent.channel_id;
    new.conversation_id := v_parent.conversation_id;
  end if;
  new.reply_count := 0;
  new.last_reply_at := null;
  new.is_edited := false;
  new.edited_at := null;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.channel_id is distinct from old.channel_id
     or new.conversation_id is distinct from old.conversation_id
     or new.author_id <> old.author_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at <> old.created_at
     or new.id <> old.id then
    raise exception 'Immutable column' using errcode = '42501';
  end if;
  -- Counters are trigger-maintained; ignore client-supplied values. Nested
  -- updates issued by messages_reply_counter() run at trigger depth > 1.
  if pg_trigger_depth() <= 1 then
    new.reply_count := old.reply_count;
    new.last_reply_at := old.last_reply_at;
  end if;
  if new.content is distinct from old.content and old.deleted_at is null then
    new.is_edited := true;
    new.edited_at := now();
  else
    new.is_edited := old.is_edited;
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

create trigger messages_before_update
  before update on public.messages
  for each row execute function public.messages_before_update();

create or replace function public.messages_reply_counter()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_parent uuid;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null and new.deleted_at is null then
      update public.messages
      set reply_count = reply_count + 1,
          last_reply_at = greatest(coalesce(last_reply_at, new.created_at), new.created_at)
      where id = new.parent_id;
    end if;
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_parent := old.parent_id;
    if v_parent is null or old.deleted_at is not null then
      return null;
    end if;
  else -- UPDATE: only care about soft-delete transitions
    v_parent := new.parent_id;
    if v_parent is null or (old.deleted_at is null) = (new.deleted_at is null) then
      return null;
    end if;
  end if;

  update public.messages p
  set reply_count = s.cnt,
      last_reply_at = s.last_at
  from (
    select count(*)::int as cnt, max(r.created_at) as last_at
    from public.messages r
    where r.parent_id = v_parent and r.deleted_at is null
      and (tg_op <> 'DELETE' or r.id <> old.id)
  ) s
  where p.id = v_parent;
  return null;
end;
$$;

create trigger messages_reply_counter
  after insert or update of deleted_at or delete on public.messages
  for each row execute function public.messages_reply_counter();

-- ---------------------------------------------------------------------------
-- Tiptap helpers (pure SQL)
-- ---------------------------------------------------------------------------

-- Mention nodes look like: {"type":"mention","attrs":{"id":"<profile uuid>|channel|here","label":"hakim"}}
create or replace function public.extract_mentions(p_content jsonb)
returns table (kind text, user_id uuid)
language sql immutable
as $$
  with nodes as (
    select n -> 'attrs' ->> 'id' as id
    from jsonb_path_query(p_content, '$.** ? (@.type == "mention")') as n
  )
  select distinct
    case when id in ('channel', 'here') then id else 'user' end as kind,
    case when id in ('channel', 'here') then null else id::uuid end as user_id
  from nodes
  where id in ('channel', 'here')
     or id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- Fallback plain-text render. The Server Action normally supplies content_text
-- (lib/utils/tiptap.ts is the reference implementation); this keeps the
-- database self-sufficient for seeds and scripts.
create or replace function public.tiptap_to_text(p_node jsonb)
returns text
language plpgsql immutable
as $$
declare
  v_type text := p_node ->> 'type';
  v_out text := '';
  v_child jsonb;
begin
  if p_node is null or jsonb_typeof(p_node) <> 'object' then
    return '';
  end if;
  if v_type = 'text' then
    return coalesce(p_node ->> 'text', '');
  elsif v_type = 'hardBreak' then
    return E'\n';
  elsif v_type = 'mention' then
    return '@' || coalesce(p_node -> 'attrs' ->> 'label', p_node -> 'attrs' ->> 'id', '');
  elsif v_type = 'emoji' then
    return coalesce(p_node -> 'attrs' ->> 'emoji', ':' || (p_node -> 'attrs' ->> 'name') || ':', '');
  end if;
  if jsonb_typeof(p_node -> 'content') = 'array' then
    for v_child in select * from jsonb_array_elements(p_node -> 'content') loop
      v_out := v_out || public.tiptap_to_text(v_child);
    end loop;
  end if;
  if v_type in ('paragraph', 'heading', 'codeBlock', 'blockquote', 'listItem', 'bulletList', 'orderedList') then
    v_out := v_out || E'\n';
  end if;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_or_create_conversation: a DM between the same set of users is reused
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(user_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_ids uuid[];
  v_id  uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select array_agg(distinct u order by u)
  into v_ids
  from unnest(array_append(coalesce(user_ids, '{}'::uuid[]), v_me)) as u
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

-- ---------------------------------------------------------------------------
-- insert_message: message + mentions + attachments in one transaction.
-- Runs as the caller (security invoker) so RLS is the single source of truth.
-- Attachments are [{storage_path, file_name, mime_type, size_bytes, width, height}]
-- and must live under the caller's folder in the `attachments` bucket.
-- ---------------------------------------------------------------------------
create or replace function public.insert_message(
  p_content jsonb,
  p_channel_id uuid default null,
  p_conversation_id uuid default null,
  p_parent_id uuid default null,
  p_content_text text default null,
  p_attachments jsonb default '[]'::jsonb,
  p_also_send_to_container boolean default false
)
returns public.messages
language plpgsql security invoker set search_path = public
as $$
declare
  v_me       uuid := auth.uid();
  v_parent   public.messages%rowtype;
  v_msg      public.messages%rowtype;
  v_copy     public.messages%rowtype;
  v_text     text;
  v_att      jsonb;
  v_path     text;
  v_channel  uuid := p_channel_id;
  v_conv     uuid := p_conversation_id;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'content must be a Tiptap document' using errcode = '22023';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.messages where id = p_parent_id;
    if not found then
      raise exception 'Parent message not found' using errcode = 'P0002';
    end if;
    v_channel := v_parent.channel_id;
    v_conv := v_parent.conversation_id;
  end if;

  if (v_channel is null) = (v_conv is null) then
    raise exception 'Exactly one of channel_id / conversation_id is required' using errcode = '22023';
  end if;
  if v_channel is not null and not public.is_channel_member(v_channel) then
    raise exception 'You are not a member of this channel' using errcode = '42501';
  end if;
  if v_conv is not null and not public.is_conversation_member(v_conv) then
    raise exception 'You are not a member of this conversation' using errcode = '42501';
  end if;

  v_text := coalesce(nullif(btrim(p_content_text), ''), btrim(public.tiptap_to_text(p_content)));
  if v_text = '' and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Message is empty' using errcode = '22023';
  end if;

  insert into public.messages (channel_id, conversation_id, author_id, parent_id, content, content_text)
  values (v_channel, v_conv, v_me, p_parent_id, p_content, v_text)
  returning * into v_msg;

  insert into public.mentions (message_id, user_id, kind)
  select v_msg.id, em.user_id, em.kind
  from public.extract_mentions(p_content) em
  where em.kind <> 'user' or exists (select 1 from public.profiles p where p.id = em.user_id)
  on conflict do nothing;

  if jsonb_typeof(p_attachments) = 'array' then
    for v_att in select * from jsonb_array_elements(p_attachments) loop
      v_path := v_att ->> 'storage_path';
      if v_path is null or v_path !~ ('^' || v_me::text || '/') then
        raise exception 'Attachment path must be inside your upload folder' using errcode = '42501';
      end if;
      insert into public.attachments (message_id, storage_path, file_name, mime_type, size_bytes, width, height)
      values (
        v_msg.id,
        v_path,
        v_att ->> 'file_name',
        v_att ->> 'mime_type',
        (v_att ->> 'size_bytes')::bigint,
        (v_att ->> 'width')::int,
        (v_att ->> 'height')::int
      );
    end loop;
  end if;

  -- "Also send to channel": a copy of the reply goes to the container as a
  -- top-level message. Attachments stay on the thread reply (paths are unique).
  if p_also_send_to_container and p_parent_id is not null then
    insert into public.messages (channel_id, conversation_id, author_id, parent_id, content, content_text)
    values (v_channel, v_conv, v_me, null, p_content, v_text)
    returning * into v_copy;

    insert into public.mentions (message_id, user_id, kind)
    select v_copy.id, em.user_id, em.kind
    from public.extract_mentions(p_content) em
    where em.kind <> 'user' or exists (select 1 from public.profiles p where p.id = em.user_id)
    on conflict do nothing;
  end if;

  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read state
-- ---------------------------------------------------------------------------
create or replace function public.mark_read(p_channel_id uuid default null, p_conversation_id uuid default null)
returns void
language sql security invoker set search_path = public
as $$
  update public.channel_members
  set last_read_at = now()
  where p_channel_id is not null and channel_id = p_channel_id and user_id = auth.uid();

  update public.conversation_members
  set last_read_at = now()
  where p_conversation_id is not null and conversation_id = p_conversation_id and user_id = auth.uid();
$$;

-- Per-container unread counts for the sidebar. Thread replies and your own
-- messages do not count. has_mention flags @you / @channel / @here.
create or replace function public.get_unread_counts()
returns table (channel_id uuid, conversation_id uuid, unread int, has_mention boolean)
language sql stable security invoker set search_path = public
as $$
  select
    cm.channel_id,
    null::uuid as conversation_id,
    count(m.id)::int as unread,
    coalesce(bool_or(exists (
      select 1 from public.mentions mn
      where mn.message_id = m.id and (mn.user_id = auth.uid() or mn.kind in ('channel', 'here'))
    )), false) as has_mention
  from public.channel_members cm
  left join public.messages m
    on m.channel_id = cm.channel_id
   and m.parent_id is null
   and m.deleted_at is null
   and m.author_id <> auth.uid()
   and m.created_at > cm.last_read_at
  where cm.user_id = auth.uid()
  group by cm.channel_id

  union all

  select
    null::uuid,
    cm.conversation_id,
    count(m.id)::int,
    coalesce(bool_or(exists (
      select 1 from public.mentions mn
      where mn.message_id = m.id and (mn.user_id = auth.uid() or mn.kind in ('channel', 'here'))
    )), false)
  from public.conversation_members cm
  left join public.messages m
    on m.conversation_id = cm.conversation_id
   and m.parent_id is null
   and m.deleted_at is null
   and m.author_id <> auth.uid()
   and m.created_at > cm.last_read_at
  where cm.user_id = auth.uid()
  group by cm.conversation_id;
$$;

-- ---------------------------------------------------------------------------
-- Full-text search (RLS applies: invoker)
-- Filters map to the UI: from:@handle -> p_from, in:#channel -> p_in_channel,
-- before:/after: -> p_before/p_after.
-- ---------------------------------------------------------------------------
create or replace function public.search_messages(
  p_query text,
  p_from uuid default null,
  p_in_channel uuid default null,
  p_in_conversation uuid default null,
  p_before timestamptz default null,
  p_after timestamptz default null,
  p_limit int default 50
)
returns setof public.messages
language sql stable security invoker set search_path = public
as $$
  select m.*
  from public.messages m
  where m.deleted_at is null
    and (nullif(btrim(p_query), '') is null or m.search_vector @@ websearch_to_tsquery('simple', p_query))
    and (p_from is null or m.author_id = p_from)
    and (p_in_channel is null or m.channel_id = p_in_channel)
    and (p_in_conversation is null or m.conversation_id = p_in_conversation)
    and (p_before is null or m.created_at < p_before)
    and (p_after is null or m.created_at > p_after)
  order by
    case when nullif(btrim(p_query), '') is null then 0
         else ts_rank_cd(m.search_vector, websearch_to_tsquery('simple', p_query)) end desc,
    m.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Privileges: trigger/internal functions are not callable from the API
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.profiles_guard_update() from public, anon, authenticated;
revoke execute on function public.channels_guard() from public, anon, authenticated;
revoke execute on function public.channel_members_guard() from public, anon, authenticated;
revoke execute on function public.channels_after_insert() from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;
revoke execute on function public.messages_before_update() from public, anon, authenticated;
revoke execute on function public.messages_reply_counter() from public, anon, authenticated;

revoke execute on function public.get_or_create_conversation(uuid[]) from public, anon;
revoke execute on function public.insert_message(jsonb, uuid, uuid, uuid, text, jsonb, boolean) from public, anon;
revoke execute on function public.mark_read(uuid, uuid) from public, anon;
revoke execute on function public.get_unread_counts() from public, anon;
revoke execute on function public.search_messages(text, uuid, uuid, uuid, timestamptz, timestamptz, int) from public, anon;

-- ---------------------------------------------------------------------------
-- Seed the two required channels (§4): #general and #random
-- ---------------------------------------------------------------------------
insert into public.channels (name, topic, description)
values
  ('general', 'Company-wide announcements and chatter', 'Everyone at Potara is here. You cannot leave this channel.'),
  ('random', 'Non-work banter, links, and memes', 'Anything goes.')
on conflict (name) do nothing;
