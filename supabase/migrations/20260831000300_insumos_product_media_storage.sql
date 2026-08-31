-- Product imagery belongs only to the independent insumos project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public insumos product media read') then
    create policy "public insumos product media read" on storage.objects for select using (bucket_id = 'product-media');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'catalog managers upload insumos product media') then
    create policy "catalog managers upload insumos product media" on storage.objects for insert with check (
      bucket_id = 'product-media' and (public.has_role('admin') or public.has_role('staff'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'catalog managers update insumos product media') then
    create policy "catalog managers update insumos product media" on storage.objects for update using (
      bucket_id = 'product-media' and (public.has_role('admin') or public.has_role('staff'))
    ) with check (
      bucket_id = 'product-media' and (public.has_role('admin') or public.has_role('staff'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'catalog managers delete insumos product media') then
    create policy "catalog managers delete insumos product media" on storage.objects for delete using (
      bucket_id = 'product-media' and (public.has_role('admin') or public.has_role('staff'))
    );
  end if;
end $$;
