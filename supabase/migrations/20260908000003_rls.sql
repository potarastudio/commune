-- Commune: Row Level Security (mandatory on every table)
-- Principles (§4):
--  * channel messages readable iff member OR channel is public
--  * conversation messages readable iff member
--  * only the author edits/deletes their message; admins can delete any
--  * profiles readable by all members, editable by owner (role by admin only)
--  * allowed_emails admin-only
-- Membership checks go through security-definer helpers to avoid recursion.

alter table public.profiles             enable row level security;
alter table public.allowed_emails       enable row level security;
alter table public.channels             enable row level security;
alter table public.channel_members      enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.reactions            enable row level security;
alter table public.attachments          enable row level security;
alter table public.mentions             enable row level security;
alter table public.pins                 enable row level security;
alter table public.saved_messages       enable row level security;
alter table public.huddles              enable row level security;
alter table public.huddle_participants  enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.custom_emoji         enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: members read all"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles: owner or admin updates"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- No insert/delete policies: rows are created by handle_new_user() and removed
-- by the auth.users cascade.

-- allowed_emails -------------------------------------------------------------
create policy "allowed_emails: admins only"
  on public.allowed_emails for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- channels -------------------------------------------------------------------
create policy "channels: public or member reads"
  on public.channels for select to authenticated
  using (not is_private or public.is_channel_member(id));

create policy "channels: members create"
  on public.channels for insert to authenticated
  with check (created_by = auth.uid());

create policy "channels: members or admin update"
  on public.channels for update to authenticated
  using (public.is_channel_member(id) or public.is_admin())
  with check (public.is_channel_member(id) or public.is_admin());

create policy "channels: admin deletes"
  on public.channels for delete to authenticated
  using (public.is_admin());

-- channel_members ------------------------------------------------------------
create policy "channel_members: visible when channel is readable"
  on public.channel_members for select to authenticated
  using (public.can_read_channel(channel_id));

-- Join a public channel yourself, or be added to any channel by an existing member.
create policy "channel_members: join or invite"
  on public.channel_members for insert to authenticated
  with check (
    (user_id = auth.uid() and public.can_read_channel(channel_id)
      and not exists (select 1 from public.channels c where c.id = channel_id and c.is_archived))
    or public.is_channel_member(channel_id)
    or public.is_admin()
  );

create policy "channel_members: own row updates"
  on public.channel_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "channel_members: leave or admin removes"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- conversations --------------------------------------------------------------
create policy "conversations: members read"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
-- Created only through get_or_create_conversation() (security definer).

create policy "conversation_members: members read"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "conversation_members: own row updates"
  on public.conversation_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "conversation_members: leave"
  on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());

-- messages -------------------------------------------------------------------
create policy "messages: readable container"
  on public.messages for select to authenticated
  using (
    (channel_id is not null and public.can_read_channel(channel_id))
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

create policy "messages: members post as themselves"
  on public.messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (channel_id is not null and public.is_channel_member(channel_id)
        and not exists (select 1 from public.channels c where c.id = channel_id and c.is_archived))
      or (conversation_id is not null and public.is_conversation_member(conversation_id))
    )
  );

-- Author edits/soft-deletes; admins may soft-delete any (content changes by
-- admins are blocked in with check).
create policy "messages: author edits, admin soft-deletes"
  on public.messages for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy "messages: author or admin deletes"
  on public.messages for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- reactions ------------------------------------------------------------------
create policy "reactions: readable message"
  on public.reactions for select to authenticated
  using (public.can_read_message(message_id));

create policy "reactions: members react as themselves"
  on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_write_message(message_id));

create policy "reactions: remove own"
  on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- attachments ----------------------------------------------------------------
create policy "attachments: readable message"
  on public.attachments for select to authenticated
  using (public.can_read_message(message_id));

create policy "attachments: message author attaches"
  on public.attachments for insert to authenticated
  with check (
    exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid())
    and storage_path like auth.uid()::text || '/%'
  );

create policy "attachments: author or admin removes"
  on public.attachments for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid())
  );

-- mentions -------------------------------------------------------------------
create policy "mentions: mine or readable message"
  on public.mentions for select to authenticated
  using (user_id = auth.uid() or public.can_read_message(message_id));

create policy "mentions: message author writes"
  on public.mentions for insert to authenticated
  with check (
    exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid())
  );

create policy "mentions: message author or admin removes"
  on public.mentions for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid())
  );

-- pins -----------------------------------------------------------------------
create policy "pins: readable message"
  on public.pins for select to authenticated
  using (public.can_read_message(message_id));

create policy "pins: members pin"
  on public.pins for insert to authenticated
  with check (pinned_by = auth.uid() and public.can_write_message(message_id));

create policy "pins: members unpin"
  on public.pins for delete to authenticated
  using (public.can_write_message(message_id) or public.is_admin());

-- saved_messages -------------------------------------------------------------
create policy "saved_messages: own rows"
  on public.saved_messages for select to authenticated
  using (user_id = auth.uid());

create policy "saved_messages: save readable"
  on public.saved_messages for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_message(message_id));

create policy "saved_messages: unsave"
  on public.saved_messages for delete to authenticated
  using (user_id = auth.uid());

-- huddles --------------------------------------------------------------------
create policy "huddles: readable container"
  on public.huddles for select to authenticated
  using (
    (channel_id is not null and public.can_read_channel(channel_id))
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

create policy "huddles: members start"
  on public.huddles for insert to authenticated
  with check (
    started_by = auth.uid()
    and (
      (channel_id is not null and public.is_channel_member(channel_id))
      or (conversation_id is not null and public.is_conversation_member(conversation_id))
    )
  );

create policy "huddles: members end"
  on public.huddles for update to authenticated
  using (
    public.is_admin()
    or (channel_id is not null and public.is_channel_member(channel_id))
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  )
  with check (
    public.is_admin()
    or (channel_id is not null and public.is_channel_member(channel_id))
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

create policy "huddle_participants: readable huddle"
  on public.huddle_participants for select to authenticated
  using (exists (select 1 from public.huddles h where h.id = huddle_id));

create policy "huddle_participants: join as self"
  on public.huddle_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.huddles h
      where h.id = huddle_id and h.ended_at is null
        and (
          (h.channel_id is not null and public.is_channel_member(h.channel_id))
          or (h.conversation_id is not null and public.is_conversation_member(h.conversation_id))
        )
    )
  );

create policy "huddle_participants: leave as self"
  on public.huddle_participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- push_subscriptions ---------------------------------------------------------
create policy "push_subscriptions: own rows"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- custom_emoji ---------------------------------------------------------------
create policy "custom_emoji: members read"
  on public.custom_emoji for select to authenticated
  using (true);

create policy "custom_emoji: members upload"
  on public.custom_emoji for insert to authenticated
  with check (created_by = auth.uid());

create policy "custom_emoji: creator or admin removes"
  on public.custom_emoji for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());
