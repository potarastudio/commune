-- Message edit history (§5 Phase 3): every edit keeps the version it replaced.
create table public.message_edits (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  content jsonb not null,
  content_text text not null,
  edited_by uuid references public.profiles (id) on delete set null,
  -- When this version was replaced (i.e. the edit happened).
  edited_at timestamptz not null default now()
);
create index message_edits_message_idx on public.message_edits (message_id, edited_at desc);

alter table public.message_edits enable row level security;
create policy "message_edits: readable with the message"
  on public.message_edits for select to authenticated
  using (public.can_read_message(message_id));
create policy "message_edits: author records"
  on public.message_edits for insert to authenticated
  with check (edited_by = auth.uid());

-- update_message() now records the outgoing version first.
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
  if v_msg.content = p_content then
    return v_msg;
  end if;

  insert into public.message_edits (message_id, content, content_text, edited_by)
  values (p_message_id, v_msg.content, v_msg.content_text, v_me);

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
