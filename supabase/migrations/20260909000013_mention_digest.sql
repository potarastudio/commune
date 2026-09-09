-- Email digest for missed mentions (§5 Phase 2): when someone has been away
-- for a while, unread @mentions older than 15 minutes are emailed via Resend.
-- The app does the sending (app/api/cron/digest); Postgres decides who is due
-- and remembers what has already gone out.

-- Presence that survives a closed tab: the client heartbeats while visible.
alter table public.profiles
  add column last_seen_at timestamptz,
  add column email_digest boolean not null default true;
comment on column public.profiles.last_seen_at is 'Last heartbeat from an open, visible Commune tab.';
comment on column public.profiles.email_digest is 'Email unread mentions when away (Settings → Notifications).';

create or replace function public.touch_last_seen()
returns void
language sql security invoker set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke execute on function public.touch_last_seen() from public, anon;

-- One row per (mention, recipient) that has been emailed. @channel mentions
-- fan out to many recipients, so this is keyed per person, not per mention.
create table public.mention_digest_log (
  mention_id uuid not null references public.mentions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (mention_id, user_id)
);
alter table public.mention_digest_log enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

-- Who is due an email, and for which mentions. Service role only.
--   away    = no heartbeat for p_offline_after (or never)
--   unread  = message newer than the recipient's last_read_at in that container
--   window  = message older than p_min_age, newer than p_max_age
-- @here is excluded on purpose: it is for people who are around right now.
-- Muted channels never email. DND hours are applied by the app in the
-- recipient's timezone before sending.
create or replace function public.pending_mention_digest(
  p_min_age interval default interval '15 minutes',
  p_max_age interval default interval '24 hours',
  p_offline_after interval default interval '5 minutes'
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  timezone text,
  dnd_start time,
  dnd_end time,
  mention_id uuid,
  kind text,
  message_id uuid,
  channel_id uuid,
  conversation_id uuid,
  parent_id uuid,
  content_text text,
  created_at timestamptz,
  author_name text,
  channel_name text
)
language sql security definer set search_path = public
as $$
  with targets as (
    -- Direct @user mentions.
    select mn.id as mention_id, mn.kind, mn.message_id, mn.user_id as target_id
    from public.mentions mn
    where mn.kind = 'user'
      and mn.created_at between now() - p_max_age and now() - p_min_age
    union all
    -- @channel fans out to every member of that channel.
    select mn.id, mn.kind, mn.message_id, cm.user_id
    from public.mentions mn
    join public.messages m on m.id = mn.message_id
    join public.channel_members cm on cm.channel_id = m.channel_id
    where mn.kind = 'channel'
      and mn.created_at between now() - p_max_age and now() - p_min_age
  )
  select
    p.id, p.email, p.display_name, p.timezone, p.dnd_start, p.dnd_end,
    t.mention_id, t.kind, m.id, m.channel_id, m.conversation_id, m.parent_id, m.content_text, m.created_at,
    a.display_name, c.name
  from targets t
  join public.messages m on m.id = t.message_id
  join public.profiles p on p.id = t.target_id
  join public.profiles a on a.id = m.author_id
  left join public.channels c on c.id = m.channel_id
  left join public.channel_members cm on cm.channel_id = m.channel_id and cm.user_id = p.id
  left join public.conversation_members vm on vm.conversation_id = m.conversation_id and vm.user_id = p.id
  where m.deleted_at is null
    and m.author_id <> p.id
    and m.created_at between now() - p_max_age and now() - p_min_age
    and p.email_digest
    and p.onboarded_at is not null
    and (p.last_seen_at is null or p.last_seen_at < now() - p_offline_after)
    and coalesce(cm.last_read_at, vm.last_read_at) < m.created_at
    and (m.channel_id is null or cm.notification_level <> 'muted')
    and not exists (
      select 1 from public.mention_digest_log l where l.mention_id = t.mention_id and l.user_id = p.id
    )
  order by p.id, m.created_at;
$$;
revoke execute on function public.pending_mention_digest(interval, interval, interval) from public, anon, authenticated;

-- Schedule: pg_cron + pg_net call the app every 5 minutes. The app URL and
-- the shared secret live in Vault (see README → Mention digest); until both
-- exist the job is a no-op, which keeps local databases quiet.
do $$
begin
  if exists (select 1 from pg_available_extensions where name in ('pg_cron'))
     and exists (select 1 from pg_available_extensions where name in ('pg_net')) then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    perform cron.unschedule(jobid) from cron.job where jobname = 'commune-mention-digest';
    perform cron.schedule(
      'commune-mention-digest',
      '*/5 * * * *',
      $job$
        select net.http_post(
          url := s.url,
          headers := jsonb_build_object('Authorization', 'Bearer ' || s.secret, 'Content-Type', 'application/json'),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        )
        from (
          select
            (select decrypted_secret from vault.decrypted_secrets where name = 'commune_digest_url') as url,
            (select decrypted_secret from vault.decrypted_secrets where name = 'commune_cron_secret') as secret
        ) s
        where s.url is not null and s.secret is not null
      $job$
    );
  else
    raise notice 'pg_cron/pg_net unavailable: mention digest not scheduled';
  end if;
end $$;
