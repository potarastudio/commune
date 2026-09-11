-- Attachments can live in Cloudflare R2 as well as Supabase Storage.
--
-- Supabase's Free plan caps uploads at 50 MB. Files above that go to a private
-- R2 bucket through presigned URLs (lib/r2.ts); the row records which store
-- holds the object so reads know where to sign. Each store keeps its own size
-- ceiling: 50 MB for Supabase, 1 GB for R2 (MAX_LARGE_ATTACHMENT_BYTES).

alter table public.attachments
  add column provider text not null default 'supabase';

alter table public.attachments
  add constraint attachments_provider_check check (provider in ('supabase', 'r2'));

alter table public.attachments drop constraint attachments_size_check;
alter table public.attachments
  add constraint attachments_size_check check (
    size_bytes is null
    or (provider = 'supabase' and size_bytes between 0 and 52428800)
    or (provider = 'r2' and size_bytes between 0 and 1073741824)
  );

-- insert_message learns the provider; everything else is unchanged from
-- 20260908000002_functions.sql.
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
  v_provider text;
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
      v_provider := coalesce(v_att ->> 'provider', 'supabase');
      if v_provider not in ('supabase', 'r2') then
        raise exception 'Unknown attachment provider' using errcode = '22023';
      end if;
      insert into public.attachments (message_id, storage_path, provider, file_name, mime_type, size_bytes, width, height)
      values (
        v_msg.id,
        v_path,
        v_provider,
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
