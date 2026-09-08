-- Commune: storage buckets and object policies
--  attachments — private, 25 MB/file. Path: <uploader uuid>/<random>/<file name>
--  avatars     — public read. Path: <user uuid>/<file name>
--  emoji       — public read. Path: <name>.<ext>

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('attachments', 'attachments', false, 26214400),
  ('avatars', 'avatars', true, 5242880),
  ('emoji', 'emoji', true, 1048576)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Read an attachment object iff the message it belongs to is readable, or you
-- uploaded it (covers the window between upload and message insert).
create or replace function public.can_read_attachment_path(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_path like auth.uid()::text || '/%'
    or exists (
      select 1 from public.attachments a
      where a.storage_path = p_path and public.can_read_message(a.message_id)
    );
$$;

-- attachments ----------------------------------------------------------------
create policy "attachments bucket: readable message or own upload"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_read_attachment_path(name));

create policy "attachments bucket: upload into own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "attachments bucket: owner or admin deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- avatars --------------------------------------------------------------------
create policy "avatars bucket: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars bucket: own folder writes"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars bucket: own folder updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars bucket: own folder deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- emoji ----------------------------------------------------------------------
create policy "emoji bucket: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'emoji');

create policy "emoji bucket: members upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'emoji');

create policy "emoji bucket: admin deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'emoji' and public.is_admin());
