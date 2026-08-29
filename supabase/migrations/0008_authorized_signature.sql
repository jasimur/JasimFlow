-- JasimFlow v4.4 — optional professional Authorized Signature line on invoices.

begin;

alter table public.businesses
  add column if not exists show_authorized_signature boolean not null default true;

grant update (show_authorized_signature)
  on table public.businesses to authenticated;

commit;

-- Refresh PostgREST/Supabase schema cache.
notify pgrst, 'reload schema';

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'businesses'
    and column_name = 'show_authorized_signature'
) as show_authorized_signature_ready;
