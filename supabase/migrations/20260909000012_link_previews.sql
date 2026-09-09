-- Link unfurling cache (§5 Phase 2): one row per URL, written by the server
-- (service role) after fetching OpenGraph data. Readable by all members.
create table public.link_previews (
  url text primary key,
  ok boolean not null default false,
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz not null default now(),
  constraint link_previews_url_check check (url ~ '^https?://')
);
comment on table public.link_previews is 'OpenGraph cache per URL. ok=false rows stop us re-fetching broken links for a while.';

alter table public.link_previews enable row level security;
create policy "link_previews: members read"
  on public.link_previews for select to authenticated
  using (true);
