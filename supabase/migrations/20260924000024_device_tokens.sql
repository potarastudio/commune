-- Push for the phone app (mobile/, Capacitor for iOS and Android).
--
-- Web push does not reach an app's web view: the app registers with APNs
-- (iOS) or FCM (Android) through its push plugin and gets a device token,
-- which the server sends to directly. One row per token. A token belongs to
-- one install, so when a phone signs in to a different account its token
-- moves to that account (the route does this with the service role; a
-- member can only ever see and remove their own rows).

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text unique not null check (char_length(token) between 8 and 4096),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

create policy "device_tokens: own rows"
  on public.device_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
