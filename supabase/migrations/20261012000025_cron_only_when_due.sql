-- The minute tick stops calling the app when there is nothing to do.
--
-- pg_cron has called app/api/cron/digest every minute since migration 19:
-- 1,440 function calls a day, nearly all of them to learn that nothing was
-- due. Around 2026-10-08 the project's data API stopped answering, every one of
-- those calls sat on Vercel until it timed out, and four days of that used an
-- hour of the Hobby plan's four CPU hours. So Postgres, which already knows
-- what is due, now asks itself first and calls only when the answer is yes.

-- The app's quiet-hours check (lib/push/dnd.ts), in SQL: the same window, to
-- the minute, in the person's own time zone, falling back to UTC for a zone
-- Postgres does not know. The digest leaves a mention pending while its
-- recipient is in quiet hours, so without this the tick would call the app
-- every minute of every night that somebody has an unread mention.
create or replace function public.in_do_not_disturb(
  p_timezone text,
  p_start time,
  p_end time,
  p_now timestamptz default now()
)
returns boolean
language plpgsql stable set search_path = public
as $$
declare
  v_local time;
begin
  if p_start is null or p_end is null then
    return false;
  end if;
  begin
    v_local := date_trunc('minute', p_now at time zone p_timezone)::time;
  exception when others then
    v_local := date_trunc('minute', p_now at time zone 'UTC')::time;
  end;
  -- Overnight windows (22:00 → 07:00) wrap past midnight.
  if p_start <= p_end then
    return v_local >= p_start and v_local < p_end;
  end if;
  return v_local >= p_start or v_local < p_end;
end $$;

-- Is there anything for the app's tick to do right now? One clause per job the
-- route runs: lib/cron/scheduled.ts, lib/cron/reminders.ts, lib/email/digest.ts.
create or replace function public.cron_work_due()
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from public.scheduled_messages where send_at <= now() and sent_message_id is null and failed is null)
    or exists (select 1 from public.reminders where remind_at <= now() and delivered_at is null)
    or exists (
      select 1 from public.pending_mention_digest() d
      where not public.in_do_not_disturb(d.timezone, d.dnd_start, d.dnd_end)
    );
$$;
revoke execute on function public.cron_work_due() from public, anon, authenticated;

do $$
declare
  v_secret uuid;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Same job, same minute schedule; the call now waits for work.
    perform cron.alter_job(
      jobid,
      command := $job$
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
        where s.url is not null and s.secret is not null and public.cron_work_due()
      $job$
    ) from cron.job where jobname = 'commune-mention-digest';

    -- pg_cron keeps a row for every run, for ever: a month of minute ticks was
    -- 54 MB of the free plan's 500. Three days is plenty to see it working.
    perform cron.unschedule(jobid) from cron.job where jobname = 'commune-cron-history';
    perform cron.schedule(
      'commune-cron-history',
      '17 3 * * *',
      $job$delete from cron.job_run_details where end_time < now() - interval '3 days'$job$
    );
  end if;

  -- The job was set up to call the project's vercel.app address, which belongs
  -- to one Vercel project and would not follow the app to another account.
  -- The custom domain does. A no-op wherever the secret is anything else.
  if to_regclass('vault.decrypted_secrets') is not null then
    select id into v_secret from vault.decrypted_secrets
    where name = 'commune_digest_url' and decrypted_secret = 'https://commune-tan.vercel.app/api/cron/digest';
    if v_secret is not null then
      perform vault.update_secret(v_secret, 'https://commune.potarastudio.com/api/cron/digest');
    end if;
  end if;
end $$;
