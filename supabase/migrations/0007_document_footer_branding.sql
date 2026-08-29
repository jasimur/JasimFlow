-- JasimFlow v4.3 — bottom document footer and optional JasimFlow/by Jasim credit.
-- Safe to run once after the earlier JasimFlow migrations.

begin;

alter table public.businesses
  add column if not exists show_document_credit boolean not null default true,
  add column if not exists document_credit_text text not null default 'Powered by JasimFlow · by Jasim';

-- Keep the user-controlled footer text compact and safe for print layout.
alter table public.businesses
  drop constraint if exists businesses_document_credit_text_length;
alter table public.businesses
  add constraint businesses_document_credit_text_length
  check (char_length(document_credit_text) <= 160);

-- Existing RLS remains authoritative. Add column-level UPDATE permission for
-- the two new user-editable settings without broadening tenant access.
grant update (show_document_credit, document_credit_text)
  on public.businesses to authenticated;

commit;

notify pgrst, 'reload schema';

select
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='show_document_credit'
  ) as show_document_credit_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='document_credit_text'
  ) as document_credit_text_ready;
