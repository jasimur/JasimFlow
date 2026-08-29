-- JasimFlow incremental upgrade:
-- 1) Direct company-logo uploads through Supabase Storage.
-- 2) User-editable document numbers with per-business/type uniqueness.
-- 3) Auto-number generator skips manually occupied future numbers.

-- Public logo bucket. Uploads remain owner-scoped by storage policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company_logos_insert_own" on storage.objects;
create policy "company_logos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "company_logos_select_own" on storage.objects;
create policy "company_logos_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "company_logos_update_own" on storage.objects;
create policy "company_logos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "company_logos_delete_own" on storage.objects;
create policy "company_logos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Race-safe auto number; also skips a number that was manually used earlier.
create or replace function public._next_document_number(p_business_id uuid, p_document_type text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_next bigint;
  v_prefix text;
  v_candidate text;
begin
  if p_document_type not in ('quotation','invoice') then
    raise exception 'Invalid document type';
  end if;

  insert into public.document_counters (business_id, document_type, next_number)
  values (p_business_id, p_document_type, 1)
  on conflict (business_id, document_type) do nothing;

  select c.next_number into v_next
  from public.document_counters c
  where c.business_id = p_business_id and c.document_type = p_document_type
  for update;

  select case when p_document_type='quotation' then quotation_prefix else invoice_prefix end
  into v_prefix
  from public.businesses where id = p_business_id;

  loop
    v_candidate := v_prefix || '-' || case when length(v_next::text) < 4 then lpad(v_next::text, 4, '0') else v_next::text end;
    exit when not exists (
      select 1 from public.documents d
      where d.business_id=p_business_id
        and d.document_type=p_document_type
        and d.document_number=v_candidate
    );
    v_next := v_next + 1;
  end loop;

  update public.document_counters
  set next_number = v_next + 1
  where business_id = p_business_id and document_type = p_document_type;

  return v_candidate;
end;
$$;
revoke all on function public._next_document_number(uuid,text) from public, anon, authenticated;

create or replace function public.create_document(p_payload jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_business public.businesses;
  v_customer uuid;
  v_type text;
  v_status text;
  v_id uuid;
  v_number text;
  v_requested_number text;
  v_item jsonb;
  v_order int := 0;
begin
  select * into v_business from public.businesses where owner_user_id=auth.uid();
  if v_business.id is null then raise exception 'No business for current user'; end if;

  v_type := p_payload->>'document_type';
  v_customer := nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then raise exception 'Customer is required'; end if;
  if v_type not in ('quotation','invoice') then raise exception 'Invalid document type'; end if;
  v_status := coalesce(nullif(p_payload->>'status',''), case when v_type='quotation' then 'draft' else 'unpaid' end);

  v_requested_number := nullif(btrim(p_payload->>'document_number'), '');
  if v_requested_number is not null then
    if char_length(v_requested_number) > 64 or v_requested_number ~ E'[\\r\\n\\t]' then
      raise exception 'Invalid document number';
    end if;
    if exists (
      select 1 from public.documents d
      where d.business_id=v_business.id and d.document_type=v_type and d.document_number=v_requested_number
    ) then
      raise exception 'Document number already exists';
    end if;
    v_number := v_requested_number;
  else
    v_number := public._next_document_number(v_business.id, v_type);
  end if;

  insert into public.documents (
    business_id, document_type, document_number, customer_id, customer_snapshot, company_snapshot, currency,
    issue_date, valid_until, due_date, status, discount_type, discount_value, tax_rate, notes, terms
  ) values (
    v_business.id, v_type, v_number, v_customer,
    public._customer_snapshot(v_business.id,v_customer), public._company_snapshot(v_business.id), v_business.currency,
    coalesce(nullif(p_payload->>'issue_date','')::date,current_date),
    case when v_type='quotation' then nullif(p_payload->>'valid_until','')::date else null end,
    case when v_type='invoice' then nullif(p_payload->>'due_date','')::date else null end,
    v_status,
    coalesce(nullif(p_payload->>'discount_type',''),'none'),
    coalesce(nullif(p_payload->>'discount_value','')::numeric,0),
    coalesce(nullif(p_payload->>'tax_rate','')::numeric,v_business.default_tax_rate),
    nullif(p_payload->>'notes',''), nullif(p_payload->>'terms','')
  ) returning id into v_id;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'A document cannot exceed 200 line items'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.document_items(document_id,catalog_item_id,description,quantity,unit,unit_price,line_total,sort_order)
    values (
      v_id,
      case
        when coalesce(v_item->>'catalog_item_id','')='' then null
        when exists (
          select 1 from public.catalog_items ci
          where ci.id=(v_item->>'catalog_item_id')::uuid and ci.business_id=v_business.id
        ) then (v_item->>'catalog_item_id')::uuid
        else null
      end,
      nullif(trim(v_item->>'description'),''),
      greatest(coalesce((v_item->>'quantity')::numeric,0),0),
      coalesce(nullif(trim(v_item->>'unit'),''),'service'),
      greatest(coalesce((v_item->>'unit_price')::numeric,0),0),
      0,
      v_order
    );
    v_order := v_order + 1;
  end loop;

  perform public._recalculate_document_totals(v_id);
  return v_id;
end;
$$;
revoke all on function public.create_document(jsonb,jsonb) from public, anon;
grant execute on function public.create_document(jsonb,jsonb) to authenticated;

create or replace function public.update_document(p_document_id uuid, p_payload jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
  v_customer uuid;
  v_requested_number text;
  v_item jsonb;
  v_order int := 0;
begin
  v_doc := public._assert_document_owner(p_document_id);
  v_customer := nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then raise exception 'Customer is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'A document cannot exceed 200 line items'; end if;

  v_requested_number := nullif(btrim(p_payload->>'document_number'), '');
  if v_requested_number is null then v_requested_number := v_doc.document_number; end if;
  if char_length(v_requested_number) > 64 or v_requested_number ~ E'[\\r\\n\\t]' then
    raise exception 'Invalid document number';
  end if;
  if exists (
    select 1 from public.documents d
    where d.business_id=v_doc.business_id
      and d.document_type=v_doc.document_type
      and d.document_number=v_requested_number
      and d.id<>p_document_id
  ) then
    raise exception 'Document number already exists';
  end if;

  update public.documents set
    document_number=v_requested_number,
    customer_id=v_customer,
    customer_snapshot=public._customer_snapshot(v_doc.business_id,v_customer),
    company_snapshot=public._company_snapshot(v_doc.business_id),
    issue_date=coalesce(nullif(p_payload->>'issue_date','')::date,issue_date),
    valid_until=case when document_type='quotation' then nullif(p_payload->>'valid_until','')::date else null end,
    due_date=case when document_type='invoice' then nullif(p_payload->>'due_date','')::date else null end,
    status=coalesce(nullif(p_payload->>'status',''),status),
    discount_type=coalesce(nullif(p_payload->>'discount_type',''),'none'),
    discount_value=coalesce(nullif(p_payload->>'discount_value','')::numeric,0),
    tax_rate=coalesce(nullif(p_payload->>'tax_rate','')::numeric,0),
    notes=nullif(p_payload->>'notes',''),
    terms=nullif(p_payload->>'terms','')
  where id=p_document_id;

  delete from public.document_items where document_id=p_document_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.document_items(document_id,catalog_item_id,description,quantity,unit,unit_price,line_total,sort_order)
    values (
      p_document_id,
      case
        when coalesce(v_item->>'catalog_item_id','')='' then null
        when exists (
          select 1 from public.catalog_items ci
          where ci.id=(v_item->>'catalog_item_id')::uuid and ci.business_id=v_doc.business_id
        ) then (v_item->>'catalog_item_id')::uuid
        else null
      end,
      nullif(trim(v_item->>'description'),''),
      greatest(coalesce((v_item->>'quantity')::numeric,0),0),
      coalesce(nullif(trim(v_item->>'unit'),''),'service'),
      greatest(coalesce((v_item->>'unit_price')::numeric,0),0),
      0,
      v_order
    );
    v_order := v_order + 1;
  end loop;

  perform public._recalculate_document_totals(p_document_id);
  return p_document_id;
end;
$$;
revoke all on function public.update_document(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.update_document(uuid,jsonb,jsonb) to authenticated;
