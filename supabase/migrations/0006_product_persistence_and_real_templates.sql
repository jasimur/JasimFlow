-- JasimFlow v4.2
-- Product persistence hardening + structurally distinct premium templates.
-- Safe to run after 0001-0005. This migration intentionally introduces NEW RPC
-- names so PostgREST cannot accidentally keep using a stale function definition.

alter table public.document_items add column if not exists product_name text;
alter table public.document_items alter column product_name set default '';
alter table public.document_items alter column description drop not null;
alter table public.document_items alter column description set default '';
alter table public.document_items alter column unit set default 'pcs';

alter table public.documents add column if not exists template_style text;
update public.documents set template_style='classic' where template_style is null or btrim(template_style)='';
alter table public.documents alter column template_style set default 'classic';
alter table public.documents alter column template_style set not null;
alter table public.documents drop constraint if exists valid_document_template_style;
alter table public.documents add constraint valid_document_template_style
check (template_style in ('classic','executive','tech','minimal','graphite','emerald','copper'));

create or replace function public.set_document_template_v2(p_document_id uuid, p_template_style text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
begin
  v_doc := public._assert_document_owner(p_document_id);
  if p_template_style not in ('classic','executive','tech','minimal','graphite','emerald','copper') then
    raise exception 'Invalid document template';
  end if;
  update public.documents set template_style=p_template_style where id=v_doc.id;
end;
$$;
revoke all on function public.set_document_template_v2(uuid,text) from public, anon;
grant execute on function public.set_document_template_v2(uuid,text) to authenticated;

create or replace function public.create_document_v2(p_payload jsonb, p_items jsonb)
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
  v_template text;
  v_id uuid;
  v_number text;
  v_requested_number text;
  v_item jsonb;
  v_product text;
  v_description text;
  v_catalog_id uuid;
  v_order int := 0;
begin
  select * into v_business from public.businesses where owner_user_id=auth.uid();
  if v_business.id is null then raise exception 'No business for current user'; end if;

  v_type := p_payload->>'document_type';
  v_customer := nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then raise exception 'Customer is required'; end if;
  if v_type not in ('quotation','invoice') then raise exception 'Invalid document type'; end if;
  if not exists (select 1 from public.customers c where c.id=v_customer and c.business_id=v_business.id) then
    raise exception 'Customer does not belong to current business';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  if jsonb_array_length(p_items)>200 then raise exception 'A document cannot exceed 200 line items'; end if;

  v_status := coalesce(nullif(p_payload->>'status',''),case when v_type='quotation' then 'draft' else 'unpaid' end);
  v_template := coalesce(nullif(p_payload->>'template_style',''),'classic');
  if v_template not in ('classic','executive','tech','minimal','graphite','emerald','copper') then raise exception 'Invalid document template'; end if;

  v_requested_number := nullif(btrim(p_payload->>'document_number'),'');
  if v_requested_number is not null then
    if char_length(v_requested_number)>64 or v_requested_number ~ E'[\r\n\t]' then raise exception 'Invalid document number'; end if;
    if exists (select 1 from public.documents d where d.business_id=v_business.id and d.document_type=v_type and d.document_number=v_requested_number) then
      raise exception 'Document number already exists';
    end if;
    v_number := v_requested_number;
  else
    v_number := public._next_document_number(v_business.id,v_type);
  end if;

  insert into public.documents(
    business_id,document_type,document_number,customer_id,customer_snapshot,company_snapshot,currency,
    issue_date,valid_until,due_date,status,template_style,discount_type,discount_value,tax_rate,notes,terms
  ) values (
    v_business.id,v_type,v_number,v_customer,
    public._customer_snapshot(v_business.id,v_customer),public._company_snapshot(v_business.id),v_business.currency,
    coalesce(nullif(p_payload->>'issue_date','')::date,current_date),
    case when v_type='quotation' then nullif(p_payload->>'valid_until','')::date else null end,
    case when v_type='invoice' then nullif(p_payload->>'due_date','')::date else null end,
    v_status,v_template,
    coalesce(nullif(p_payload->>'discount_type',''),'none'),
    coalesce(nullif(p_payload->>'discount_value','')::numeric,0),
    coalesce(nullif(p_payload->>'tax_rate','')::numeric,v_business.default_tax_rate),
    nullif(p_payload->>'notes',''),nullif(p_payload->>'terms','')
  ) returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    -- product_name is canonical. item_name is a redundant compatibility guard.
    v_product := nullif(btrim(coalesce(v_item->>'product_name',v_item->>'item_name','')),'');
    v_description := coalesce(btrim(v_item->>'description'),'');
    if v_product is null then raise exception 'Every line item needs a product or service name'; end if;

    v_catalog_id := null;
    if coalesce(v_item->>'catalog_item_id','')<>'' then
      begin
        if exists (
          select 1 from public.catalog_items ci
          where ci.id=(v_item->>'catalog_item_id')::uuid and ci.business_id=v_business.id
        ) then
          v_catalog_id := (v_item->>'catalog_item_id')::uuid;
        end if;
      exception when invalid_text_representation then
        v_catalog_id := null;
      end;
    end if;

    insert into public.document_items(
      document_id,catalog_item_id,product_name,description,quantity,unit,unit_price,line_total,sort_order
    ) values (
      v_id,v_catalog_id,v_product,v_description,
      greatest(coalesce(nullif(v_item->>'quantity','')::numeric,0),0),
      coalesce(nullif(btrim(v_item->>'unit'),''),'pcs'),
      greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0),
      0,v_order
    );
    v_order:=v_order+1;
  end loop;

  perform public._recalculate_document_totals(v_id);
  return v_id;
end;
$$;
revoke all on function public.create_document_v2(jsonb,jsonb) from public, anon;
grant execute on function public.create_document_v2(jsonb,jsonb) to authenticated;

create or replace function public.update_document_v2(p_document_id uuid,p_payload jsonb,p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
  v_customer uuid;
  v_requested_number text;
  v_template text;
  v_item jsonb;
  v_product text;
  v_description text;
  v_catalog_id uuid;
  v_order int:=0;
begin
  v_doc := public._assert_document_owner(p_document_id);
  v_customer := nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then raise exception 'Customer is required'; end if;
  if not exists (select 1 from public.customers c where c.id=v_customer and c.business_id=v_doc.business_id) then
    raise exception 'Customer does not belong to current business';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  if jsonb_array_length(p_items)>200 then raise exception 'A document cannot exceed 200 line items'; end if;

  v_requested_number := nullif(btrim(p_payload->>'document_number'),'');
  if v_requested_number is null then v_requested_number:=v_doc.document_number; end if;
  if char_length(v_requested_number)>64 or v_requested_number ~ E'[\r\n\t]' then raise exception 'Invalid document number'; end if;
  if exists (
    select 1 from public.documents d
    where d.business_id=v_doc.business_id and d.document_type=v_doc.document_type
      and d.document_number=v_requested_number and d.id<>p_document_id
  ) then raise exception 'Document number already exists'; end if;

  v_template := coalesce(nullif(p_payload->>'template_style',''),v_doc.template_style,'classic');
  if v_template not in ('classic','executive','tech','minimal','graphite','emerald','copper') then raise exception 'Invalid document template'; end if;

  update public.documents set
    document_number=v_requested_number,
    customer_id=v_customer,
    customer_snapshot=public._customer_snapshot(v_doc.business_id,v_customer),
    company_snapshot=public._company_snapshot(v_doc.business_id),
    issue_date=coalesce(nullif(p_payload->>'issue_date','')::date,issue_date),
    valid_until=case when document_type='quotation' then nullif(p_payload->>'valid_until','')::date else null end,
    due_date=case when document_type='invoice' then nullif(p_payload->>'due_date','')::date else null end,
    status=coalesce(nullif(p_payload->>'status',''),status),
    template_style=v_template,
    discount_type=coalesce(nullif(p_payload->>'discount_type',''),'none'),
    discount_value=coalesce(nullif(p_payload->>'discount_value','')::numeric,0),
    tax_rate=coalesce(nullif(p_payload->>'tax_rate','')::numeric,0),
    notes=nullif(p_payload->>'notes',''),
    terms=nullif(p_payload->>'terms','')
  where id=p_document_id;

  -- Rebuild the snapshot rows from the exact editor payload. This makes Product
  -- and Description independent and prevents legacy Description->Product fallback.
  delete from public.document_items where document_id=p_document_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product := nullif(btrim(coalesce(v_item->>'product_name',v_item->>'item_name','')),'');
    v_description := coalesce(btrim(v_item->>'description'),'');
    if v_product is null then raise exception 'Every line item needs a product or service name'; end if;

    v_catalog_id:=null;
    if coalesce(v_item->>'catalog_item_id','')<>'' then
      begin
        if exists (
          select 1 from public.catalog_items ci
          where ci.id=(v_item->>'catalog_item_id')::uuid and ci.business_id=v_doc.business_id
        ) then
          v_catalog_id := (v_item->>'catalog_item_id')::uuid;
        end if;
      exception when invalid_text_representation then
        v_catalog_id:=null;
      end;
    end if;

    insert into public.document_items(
      document_id,catalog_item_id,product_name,description,quantity,unit,unit_price,line_total,sort_order
    ) values (
      p_document_id,v_catalog_id,v_product,v_description,
      greatest(coalesce(nullif(v_item->>'quantity','')::numeric,0),0),
      coalesce(nullif(btrim(v_item->>'unit'),''),'pcs'),
      greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0),
      0,v_order
    );
    v_order:=v_order+1;
  end loop;

  perform public._recalculate_document_totals(p_document_id);
  return p_document_id;
end;
$$;
revoke all on function public.update_document_v2(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.update_document_v2(uuid,jsonb,jsonb) to authenticated;

notify pgrst,'reload schema';

-- Verification: all three values should be true after this script completes.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='document_items' and column_name='product_name') as product_name_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='template_style') as template_style_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='update_document_v2') as new_rpc_ready;
