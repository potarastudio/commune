-- update_message(): edit content and re-sync mentions in one transaction.
-- Runs as the caller; the messages update policy (author only) applies.
create or replace function public.update_message(
  p_message_id uuid,
  p_content jsonb,
  p_content_text text default null
)
returns public.messages
language plpgsql security invoker set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_msg  public.messages%rowtype;
  v_text text;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'content must be a Tiptap document' using errcode = '22023';
  end if;

  select * into v_msg from public.messages where id = p_message_id;
  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  if v_msg.author_id <> v_me then
    raise exception 'Only the author can edit a message' using errcode = '42501';
  end if;
  if v_msg.deleted_at is not null then
    raise exception 'Deleted messages cannot be edited' using errcode = 'P0001';
  end if;

  v_text := coalesce(nullif(btrim(p_content_text), ''), btrim(public.tiptap_to_text(p_content)));
  if v_text = '' and not exists (select 1 from public.attachments a where a.message_id = p_message_id) then
    raise exception 'Message is empty' using errcode = '22023';
  end if;

  update public.messages
  set content = p_content, content_text = v_text
  where id = p_message_id
  returning * into v_msg;

  delete from public.mentions where message_id = p_message_id;
  insert into public.mentions (message_id, user_id, kind)
  select p_message_id, em.user_id, em.kind
  from public.extract_mentions(p_content) em
  where em.kind <> 'user' or exists (select 1 from public.profiles p where p.id = em.user_id)
  on conflict do nothing;

  return v_msg;
end;
$$;

revoke execute on function public.update_message(uuid, jsonb, text) from public, anon;

-- Pins and saved messages travel with the message row for the hover bar.
alter table public.pins replica identity full;
alter publication supabase_realtime add table public.pins;
