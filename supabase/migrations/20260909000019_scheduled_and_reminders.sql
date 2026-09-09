-- Message scheduling and reminders (§5 Phase 3). Both are delivered by the
-- app's cron route (app/api/cron/digest), which pg_cron now calls every minute.

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  content jsonb not null,
  content_text text not null,
  send_at timestamptz not null,
  sent_message_id uuid references public.messages (id) on delete set null,
  failed text,
  created_at timestamptz not null default now(),
  constraint scheduled_messages_container_check check ((channel_id is null) <> (conversation_id is null))
);
create index scheduled_messages_due_idx on public.scheduled_messages (send_at) where sent_message_id is null and failed is null;
create index scheduled_messages_author_idx on public.scheduled_messages (author_id, send_at);

alter table public.scheduled_messages enable row level security;
create policy "scheduled_messages: own rows"
  on public.scheduled_messages for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  remind_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_due_idx on public.reminders (remind_at) where delivered_at is null;
create index reminders_user_idx on public.reminders (user_id, remind_at);

alter table public.reminders enable row level security;
create policy "reminders: own rows"
  on public.reminders for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_read_message(message_id));

-- Minute-level delivery: the digest job's schedule tightens from */5 to every minute.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '* * * * *') from cron.job where jobname = 'commune-mention-digest';
  end if;
end $$;
