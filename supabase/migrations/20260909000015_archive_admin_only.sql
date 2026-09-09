-- Archiving is an admin action (§5 Phase 3). Members may still edit topic and
-- description through the existing update policy; flipping is_archived or
-- is_private needs is_admin(). Service role / migrations (auth.uid() null) pass.
create or replace function public.channels_guard_admin_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.is_archived is distinct from old.is_archived then
      raise exception 'Only admins can archive or restore a channel' using errcode = '42501';
    end if;
    if new.is_private is distinct from old.is_private then
      raise exception 'Only admins can change whether a channel is private' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists channels_guard_admin_columns on public.channels;
create trigger channels_guard_admin_columns
  before update on public.channels
  for each row execute function public.channels_guard_admin_columns();
