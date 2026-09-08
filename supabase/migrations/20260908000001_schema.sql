-- Commune: core schema (§4 of CLAUDE.md)
-- Tables, constraints and indexes only. Functions/triggers, RLS, storage and
-- realtime live in the following migrations so each concern is reviewable.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles — one row per user, mirrors auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  display_name text not null,
  handle text unique not null,
  avatar_url text,
  title text,
  status_text text,
  status_emoji text,
  status_expires_at timestamptz,
  timezone text not null default 'Asia/Jakarta',
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'member')),
  constraint profiles_handle_check check (handle ~ '^[a-z0-9][a-z0-9._-]{0,29}$'),
  constraint profiles_display_name_check check (length(btrim(display_name)) between 1 and 80)
);
comment on table public.profiles is 'One row per user. Created by handle_new_user() on auth.users insert.';
comment on column public.profiles.handle is 'Lowercase @mention handle, unique.';

-- ---------------------------------------------------------------------------
-- allowed_emails — invite allowlist, checked by handle_new_user()
-- ---------------------------------------------------------------------------
create table public.allowed_emails (
  email text primary key,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint allowed_emails_lowercase check (email = lower(email))
);

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  topic text,
  description text,
  is_private boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint channels_name_check check (name ~ '^[a-z0-9-]{1,40}$'),
  constraint channels_topic_length check (topic is null or length(topic) <= 250),
  constraint channels_description_length check (description is null or length(description) <= 1000)
);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  notification_level text not null default 'all',
  primary key (channel_id, user_id),
  constraint channel_members_notification_level_check
    check (notification_level in ('all', 'mentions', 'muted'))
);
create index channel_members_user_id_idx on public.channel_members (user_id);

-- ---------------------------------------------------------------------------
-- conversations — DMs and group DMs (membership defines the participants)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_id_idx on public.conversation_members (user_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.messages (id) on delete cascade,
  content jsonb not null,
  content_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', content_text)) stored,
  reply_count int not null default 0,
  last_reply_at timestamptz,
  is_edited boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_exactly_one_container
    check ((channel_id is null) <> (conversation_id is null)),
  constraint messages_content_is_doc check (jsonb_typeof(content) = 'object'),
  constraint messages_not_own_parent check (parent_id is null or parent_id <> id)
);
comment on column public.messages.content is 'Tiptap JSON document.';
comment on column public.messages.content_text is 'Plain-text render of content; generated server-side, never by the client.';
comment on column public.messages.parent_id is 'Non-null => thread reply. Replies always share the parent''s container.';

create index messages_channel_created_idx
  on public.messages (channel_id, created_at desc, id desc) where channel_id is not null;
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc) where conversation_id is not null;
create index messages_parent_created_idx
  on public.messages (parent_id, created_at, id) where parent_id is not null;
create index messages_author_idx on public.messages (author_id, created_at desc);
create index messages_search_idx on public.messages using gin (search_vector);

-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------
create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint reactions_emoji_length check (length(emoji) between 1 and 64)
);

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  created_at timestamptz not null default now(),
  constraint attachments_size_check check (size_bytes is null or size_bytes between 0 and 26214400)
);
create index attachments_message_idx on public.attachments (message_id);

-- ---------------------------------------------------------------------------
-- mentions — denormalised for "mentions of me" and notifications
-- ---------------------------------------------------------------------------
create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint mentions_kind_check check (kind in ('user', 'channel', 'here')),
  constraint mentions_user_id_matches_kind
    check ((kind = 'user' and user_id is not null) or (kind <> 'user' and user_id is null))
);
create unique index mentions_message_user_kind_idx
  on public.mentions (message_id, user_id, kind) nulls not distinct;
create index mentions_user_created_idx on public.mentions (user_id, created_at desc);
create index mentions_message_idx on public.mentions (message_id);

-- ---------------------------------------------------------------------------
-- pins — the message already knows its container, so this works for DMs too
-- ---------------------------------------------------------------------------
create table public.pins (
  message_id uuid primary key references public.messages (id) on delete cascade,
  pinned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- saved_messages — "Saved for later"
-- ---------------------------------------------------------------------------
create table public.saved_messages (
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

-- ---------------------------------------------------------------------------
-- huddles
-- ---------------------------------------------------------------------------
create table public.huddles (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  livekit_room text unique not null,
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint huddles_exactly_one_container
    check ((channel_id is null) <> (conversation_id is null))
);
-- Only one live huddle per container at a time.
create unique index huddles_one_active_per_channel_idx
  on public.huddles (channel_id) where ended_at is null and channel_id is not null;
create unique index huddles_one_active_per_conversation_idx
  on public.huddles (conversation_id) where ended_at is null and conversation_id is not null;

create table public.huddle_participants (
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (huddle_id, user_id, joined_at)
);
create index huddle_participants_active_idx
  on public.huddle_participants (huddle_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- custom_emoji
-- ---------------------------------------------------------------------------
create table public.custom_emoji (
  name text primary key,
  storage_path text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint custom_emoji_name_check check (name ~ '^[a-z0-9_]{1,32}$')
);
