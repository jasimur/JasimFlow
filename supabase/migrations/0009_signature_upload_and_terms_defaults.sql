-- JasimFlow v4.5
-- 1) Optional authorized-signature image upload for invoices.
-- 2) Keeps invoice and quotation default Terms & Conditions separate.
--    The two default term columns already exist in the base schema; this migration
--    verifies/repairs them idempotently for upgraded installations.

begin;

alter table public.businesses
  add column if not exists signature_url text;

alter table public.businesses
  add column if not exists default_invoice_terms text,
  add column if not exists default_quotation_terms text;

-- Existing column-level grants intentionally do not allow tenant keys/owner ids.
grant update (signature_url, default_invoice_terms, default_quotation_terms)
on public.businesses to authenticated;

-- Dedicated public bucket. Objects are write/read/delete scoped to the first folder
-- component (auth.uid()). The generated public URL is used by browser print/PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'authorized-signatures',
  'authorized-signatures',
  true,
  1048576,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authorized_signatures_insert_own" on storage.objects;
create policy "authorized_signatures_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'authorized-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authorized_signatures_select_own" on storage.objects;
create policy "authorized_signatures_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'authorized-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authorized_signatures_update_own" on storage.objects;
create policy "authorized_signatures_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'authorized-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'authorized-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authorized_signatures_delete_own" on storage.objects;
create policy "authorized_signatures_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'authorized-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

-- Ask PostgREST/Supabase API to refresh its schema cache after the new column/grants.
notify pgrst, 'reload schema';

select
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='signature_url'
  ) as signature_url_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='default_invoice_terms'
  ) as invoice_terms_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='default_quotation_terms'
  ) as quotation_terms_ready,
  exists (
    select 1 from storage.buckets where id='authorized-signatures'
  ) as signature_bucket_ready;
