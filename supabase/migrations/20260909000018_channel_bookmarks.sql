-- Channel bookmarks bar (§5 Phase 3): pinned links under the channel header.
create table public.channel_bookmarks (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  title text not null,
  url text not null,
  emoji text,
  position int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint channel_bookmarks_title_check check (length(btrim(title)) between 1 and 80),
  constraint channel_bookmarks_url_check check (url ~* '^https?://' and length(url) <= 2048),
  constraint channel_bookmarks_emoji_check check (emoji is null or length(emoji) <= 16)
);
create index channel_bookmarks_channel_idx on public.channel_bookmarks (channel_id, position, created_at);

alter table public.channel_bookmarks enable row level security;
create policy "channel_bookmarks: readable with the channel"
  on public.channel_bookmarks for select to authenticated
  using (public.can_read_channel(channel_id));
create policy "channel_bookmarks: members add"
  on public.channel_bookmarks for insert to authenticated
  with check (created_by = auth.uid() and (public.is_channel_member(channel_id) or public.is_admin()));
create policy "channel_bookmarks: members edit"
  on public.channel_bookmarks for update to authenticated
  using (public.is_channel_member(channel_id) or public.is_admin())
  with check (public.is_channel_member(channel_id) or public.is_admin());
create policy "channel_bookmarks: members remove"
  on public.channel_bookmarks for delete to authenticated
  using (public.is_channel_member(channel_id) or public.is_admin());

alter table public.channel_bookmarks replica identity full;
alter publication supabase_realtime add table public.channel_bookmarks;
