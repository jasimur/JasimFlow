-- JasimFlow initial schema
-- PostgreSQL/Supabase: tenant-isolated quotation + invoice MVP.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Business',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  tax_number text,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  default_tax_rate numeric(9,4) not null default 0 check (default_tax_rate >= 0 and default_tax_rate <= 100),
  quotation_prefix text not null default 'QUO' check (quotation_prefix ~ '^[A-Za-z0-9_-]{1,12}$'),
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Za-z0-9_-]{1,12}$'),
  default_quotation_terms text,
  default_invoice_terms text,
  bank_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null check (document_type in ('quotation','invoice')),
  next_number bigint not null default 1 check (next_number > 0),
  primary key (business_id, document_type)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  billing_address text,
  tax_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  default_unit text not null default 'service',
  default_rate numeric(18,4) not null default 0 check (default_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null check (document_type in ('quotation','invoice')),
  document_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  company_snapshot jsonb not null default '{}'::jsonb,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  issue_date date not null default current_date,
  valid_until date,
  due_date date,
  status text not null,
  subtotal numeric(18,2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none','percentage','fixed')),
  discount_value numeric(18,4) not null default 0 check (discount_value >= 0),
  discount_amount numeric(18,2) not null default 0,
  tax_rate numeric(9,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  notes text,
  terms text,
  source_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_document_status check (
    (document_type = 'quotation' and status in ('draft','sent','accepted','rejected','expired')) or
    (document_type = 'invoice' and status in ('draft','unpaid','paid','overdue','cancelled'))
  ),
  constraint valid_document_dates check (
    (document_type = 'quotation' and valid_until is not null and valid_until >= issue_date) or
    (document_type = 'invoice' and due_date is not null and due_date >= issue_date)
  ),
  constraint valid_percentage_discount check (discount_type <> 'percentage' or discount_value <= 100),
  unique (business_id, document_type, document_number)
);

create unique index if not exists one_invoice_per_quotation
  on public.documents(source_document_id)
  where document_type = 'invoice' and source_document_id is not null;

create index if not exists documents_business_type_date_idx
  on public.documents(business_id, document_type, issue_date desc);
create index if not exists documents_business_status_idx
  on public.documents(business_id, status);

create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  description text not null,
  quantity numeric(18,4) not null default 1 check (quantity >= 0),
  unit text not null default 'service',
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  line_total numeric(18,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists document_items_document_idx on public.document_items(document_id, sort_order);

-- Generic updated_at trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();
drop trigger if exists catalog_items_updated_at on public.catalog_items;
create trigger catalog_items_updated_at before update on public.catalog_items
for each row execute function public.set_updated_at();
drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

-- Auto-provision one business per auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.businesses (owner_user_id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'business_name',''), 'My Business'), new.email)
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill businesses for pre-existing users when migration is first installed.
insert into public.businesses (owner_user_id, name, email)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'business_name',''), 'My Business'), u.email
from auth.users u
where not exists (select 1 from public.businesses b where b.owner_user_id = u.id);

-- RLS helpers.
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select b.id from public.businesses b where b.owner_user_id = auth.uid() limit 1
$$;
revoke all on function public.current_business_id() from public, anon;
grant execute on function public.current_business_id() to authenticated;

alter table public.businesses enable row level security;
alter table public.document_counters enable row level security;
alter table public.customers enable row level security;
alter table public.catalog_items enable row level security;
alter table public.documents enable row level security;
alter table public.document_items enable row level security;

create policy businesses_select_own on public.businesses for select to authenticated
using (owner_user_id = auth.uid());
create policy businesses_update_own on public.businesses for update to authenticated
using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy counters_select_own on public.document_counters for select to authenticated
using (business_id = public.current_business_id());

create policy customers_all_own on public.customers for all to authenticated
using (business_id = public.current_business_id())
with check (business_id = public.current_business_id());

create policy catalog_all_own on public.catalog_items for all to authenticated
using (business_id = public.current_business_id())
with check (business_id = public.current_business_id());

create policy documents_select_own on public.documents for select to authenticated
using (business_id = public.current_business_id());
create policy documents_delete_own on public.documents for delete to authenticated
using (business_id = public.current_business_id());

create policy document_items_select_own on public.document_items for select to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = document_id and d.business_id = public.current_business_id()
));

-- Keep document mutations behind audited RPCs. Direct authenticated writes are not granted.
revoke all on public.businesses from anon, authenticated;
revoke all on public.document_counters from anon, authenticated;
revoke all on public.customers from anon, authenticated;
revoke all on public.catalog_items from anon, authenticated;
revoke all on public.documents from anon, authenticated;
revoke all on public.document_items from anon, authenticated;

grant select on public.businesses to authenticated;
grant update (name,logo_url,address,phone,email,website,tax_number,currency,default_tax_rate,quotation_prefix,invoice_prefix,default_quotation_terms,default_invoice_terms,bank_details) on public.businesses to authenticated;
grant select on public.document_counters to authenticated;

grant select, delete on public.customers to authenticated;
grant insert (business_id,name,contact_person,phone,email,billing_address,tax_number,notes) on public.customers to authenticated;
grant update (name,contact_person,phone,email,billing_address,tax_number,notes) on public.customers to authenticated;

grant select, delete on public.catalog_items to authenticated;
grant insert (business_id,name,description,default_unit,default_rate) on public.catalog_items to authenticated;
grant update (name,description,default_unit,default_rate) on public.catalog_items to authenticated;

grant select, delete on public.documents to authenticated;
grant select on public.document_items to authenticated;

-- Internal helper: get a race-safe next number. Not executable by client roles.
create or replace function public._next_document_number(p_business_id uuid, p_document_type text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_next bigint;
  v_prefix text;
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

  update public.document_counters
  set next_number = v_next + 1
  where business_id = p_business_id and document_type = p_document_type;

  select case when p_document_type='quotation' then quotation_prefix else invoice_prefix end
  into v_prefix
  from public.businesses where id = p_business_id;

  return v_prefix || '-' || case when length(v_next::text) < 4 then lpad(v_next::text, 4, '0') else v_next::text end;
end;
$$;
revoke all on function public._next_document_number(uuid,text) from public, anon, authenticated;

-- Internal helper: ownership check.
create or replace function public._assert_document_owner(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_doc public.documents;
begin
  select d.* into v_doc
  from public.documents d
  join public.businesses b on b.id=d.business_id
  where d.id=p_document_id and b.owner_user_id=auth.uid();
  if v_doc.id is null then raise exception 'Document not found or access denied'; end if;
  return v_doc;
end;
$$;
revoke all on function public._assert_document_owner(uuid) from public, anon, authenticated;

-- Internal calculation helper. PostgreSQL NUMERIC is authoritative.
create or replace function public._recalculate_document_totals(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
  v_subtotal numeric(18,2);
  v_discount numeric(18,2);
  v_base numeric(18,2);
  v_tax numeric(18,2);
begin
  v_doc := public._assert_document_owner(p_document_id);

  update public.document_items
  set line_total = round(quantity * unit_price, 2)
  where document_id = p_document_id;

  select coalesce(round(sum(line_total),2),0) into v_subtotal
  from public.document_items where document_id=p_document_id;

  if v_doc.discount_type='percentage' then
    v_discount := round(v_subtotal * least(v_doc.discount_value,100) / 100, 2);
  elsif v_doc.discount_type='fixed' then
    v_discount := least(round(v_doc.discount_value,2), v_subtotal);
  else
    v_discount := 0;
  end if;

  v_discount := greatest(v_discount,0);
  v_base := greatest(v_subtotal - v_discount, 0);
  v_tax := round(v_base * least(greatest(v_doc.tax_rate,0),100) / 100, 2);

  update public.documents
  set subtotal=v_subtotal,
      discount_amount=v_discount,
      tax_amount=v_tax,
      grand_total=round(v_base + v_tax,2)
  where id=p_document_id;
end;
$$;
revoke all on function public._recalculate_document_totals(uuid) from public, anon, authenticated;

-- Build snapshots after explicit ownership validation.
create or replace function public._customer_snapshot(p_business_id uuid, p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'name',c.name,'contact_person',c.contact_person,'phone',c.phone,'email',c.email,
    'billing_address',c.billing_address,'tax_number',c.tax_number
  ) into v
  from public.customers c where c.id=p_customer_id and c.business_id=p_business_id;
  if v is null then raise exception 'Customer not found or access denied'; end if;
  return v;
end;
$$;
revoke all on function public._customer_snapshot(uuid,uuid) from public, anon, authenticated;

create or replace function public._company_snapshot(p_business_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'name',b.name,'logo_url',b.logo_url,'address',b.address,'phone',b.phone,'email',b.email,
    'website',b.website,'tax_number',b.tax_number,'bank_details',b.bank_details
  ) from public.businesses b where b.id=p_business_id
$$;
revoke all on function public._company_snapshot(uuid) from public, anon, authenticated;

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
  v_number := public._next_document_number(v_business.id, v_type);

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
  v_item jsonb;
  v_order int := 0;
begin
  v_doc := public._assert_document_owner(p_document_id);
  v_customer := nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then raise exception 'Customer is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'A document cannot exceed 200 line items'; end if;

  update public.documents set
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

create or replace function public.duplicate_document(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
  v_new uuid;
  v_number text;
begin
  v_doc := public._assert_document_owner(p_document_id);
  v_number := public._next_document_number(v_doc.business_id,v_doc.document_type);

  insert into public.documents(
    business_id,document_type,document_number,customer_id,customer_snapshot,company_snapshot,currency,
    issue_date,valid_until,due_date,status,discount_type,discount_value,tax_rate,notes,terms
  ) values (
    v_doc.business_id,v_doc.document_type,v_number,v_doc.customer_id,v_doc.customer_snapshot,public._company_snapshot(v_doc.business_id),v_doc.currency,
    current_date,
    case when v_doc.document_type='quotation' then current_date + 30 else null end,
    case when v_doc.document_type='invoice' then current_date + 14 else null end,
    case when v_doc.document_type='quotation' then 'draft' else 'unpaid' end,
    v_doc.discount_type,v_doc.discount_value,v_doc.tax_rate,v_doc.notes,v_doc.terms
  ) returning id into v_new;

  insert into public.document_items(document_id,catalog_item_id,description,quantity,unit,unit_price,line_total,sort_order)
  select v_new,catalog_item_id,description,quantity,unit,unit_price,0,sort_order
  from public.document_items where document_id=p_document_id order by sort_order;

  perform public._recalculate_document_totals(v_new);
  return v_new;
end;
$$;
revoke all on function public.duplicate_document(uuid) from public, anon;
grant execute on function public.duplicate_document(uuid) to authenticated;

create or replace function public.convert_quotation_to_invoice(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents;
  v_existing uuid;
  v_new uuid;
  v_number text;
begin
  v_doc := public._assert_document_owner(p_document_id);
  if v_doc.document_type <> 'quotation' then raise exception 'Only quotations can be converted'; end if;

  select id into v_existing from public.documents
  where source_document_id=p_document_id and document_type='invoice' limit 1;
  if v_existing is not null then return jsonb_build_object('id',v_existing,'already_existed',true); end if;

  v_number := public._next_document_number(v_doc.business_id,'invoice');
  begin
    insert into public.documents(
      business_id,document_type,document_number,customer_id,customer_snapshot,company_snapshot,currency,
      issue_date,due_date,status,discount_type,discount_value,tax_rate,notes,terms,source_document_id
    ) values (
      v_doc.business_id,'invoice',v_number,v_doc.customer_id,v_doc.customer_snapshot,public._company_snapshot(v_doc.business_id),v_doc.currency,
      current_date,current_date+14,'unpaid',v_doc.discount_type,v_doc.discount_value,v_doc.tax_rate,v_doc.notes,v_doc.terms,p_document_id
    ) returning id into v_new;
  exception when unique_violation then
    select id into v_new from public.documents where source_document_id=p_document_id and document_type='invoice';
    return jsonb_build_object('id',v_new,'already_existed',true);
  end;

  insert into public.document_items(document_id,catalog_item_id,description,quantity,unit,unit_price,line_total,sort_order)
  select v_new,catalog_item_id,description,quantity,unit,unit_price,0,sort_order
  from public.document_items where document_id=p_document_id order by sort_order;
  perform public._recalculate_document_totals(v_new);
  return jsonb_build_object('id',v_new,'already_existed',false);
end;
$$;
revoke all on function public.convert_quotation_to_invoice(uuid) from public, anon;
grant execute on function public.convert_quotation_to_invoice(uuid) to authenticated;

create or replace function public.set_document_status(p_document_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_doc public.documents;
begin
  v_doc := public._assert_document_owner(p_document_id);
  if (v_doc.document_type='quotation' and p_status not in ('draft','sent','accepted','rejected','expired')) or
     (v_doc.document_type='invoice' and p_status not in ('draft','unpaid','paid','overdue','cancelled')) then
    raise exception 'Invalid status for document type';
  end if;
  update public.documents set status=p_status where id=p_document_id;
end;
$$;
revoke all on function public.set_document_status(uuid,text) from public, anon;
grant execute on function public.set_document_status(uuid,text) to authenticated;

-- Optional user-scoped demo seed. Safe to run repeatedly; it only seeds when the business has no customers.
create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_business public.businesses;
  v_c1 uuid; v_c2 uuid;
  v_i1 uuid; v_i2 uuid;
  v_doc uuid;
begin
  select * into v_business from public.businesses where owner_user_id=auth.uid();
  if v_business.id is null then raise exception 'No business for current user'; end if;
  if exists(select 1 from public.customers where business_id=v_business.id) then return; end if;

  insert into public.customers(business_id,name,email,billing_address) values
    (v_business.id,'Acme Studio','billing@acme.example','12 Market Street') returning id into v_c1;
  insert into public.customers(business_id,name,email,billing_address) values
    (v_business.id,'Northwind Works','accounts@northwind.example','88 Harbour Road') returning id into v_c2;
  insert into public.catalog_items(business_id,name,description,default_unit,default_rate) values
    (v_business.id,'Consulting','Professional consulting service','hour',85) returning id into v_i1;
  insert into public.catalog_items(business_id,name,description,default_unit,default_rate) values
    (v_business.id,'Implementation','Implementation package','job',450) returning id into v_i2;

  v_doc := public.create_document(
    jsonb_build_object('document_type','quotation','customer_id',v_c1,'issue_date',current_date,'valid_until',current_date+30,'status','sent','discount_type','percentage','discount_value','5','tax_rate',v_business.default_tax_rate,'notes','Thank you for the opportunity.','terms',coalesce(v_business.default_quotation_terms,'')),
    jsonb_build_array(jsonb_build_object('catalog_item_id',v_i1,'description','Consulting','quantity','4','unit','hour','unit_price','85'))
  );
  perform public.create_document(
    jsonb_build_object('document_type','invoice','customer_id',v_c2,'issue_date',current_date,'due_date',current_date+14,'status','unpaid','discount_type','none','discount_value','0','tax_rate',v_business.default_tax_rate,'notes','','terms',coalesce(v_business.default_invoice_terms,'')),
    jsonb_build_array(jsonb_build_object('catalog_item_id',v_i2,'description','Implementation','quantity','1','unit','job','unit_price','450'))
  );
end;
$$;
revoke all on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
