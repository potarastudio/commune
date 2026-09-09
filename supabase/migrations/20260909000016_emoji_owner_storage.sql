-- Custom emoji (§5 Phase 3): whoever uploaded an image in the public `emoji`
-- bucket may replace or remove it (owner is set by Storage on upload). Admins
-- keep their delete-anything policy from migration 4.
create policy "emoji bucket: owner updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'emoji' and owner = auth.uid())
  with check (bucket_id = 'emoji' and owner = auth.uid());

create policy "emoji bucket: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'emoji' and owner = auth.uid());
