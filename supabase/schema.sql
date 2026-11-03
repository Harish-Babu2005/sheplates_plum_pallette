-- ShePlates base production reference schema for Supabase PostgreSQL.
-- New projects run this file first, followed by V3_UPGRADE.sql.
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer','vendor','operations','admin');
create type public.verification_status as enum ('draft','submitted','under_review','changes_required','verified','rejected','expired');
create type public.operational_status as enum ('inactive','active','paused','suspended');
create type public.order_status as enum ('awarded','confirmed','preparing','ready','out_for_delivery','ready_for_pickup','completed','delivered','cancellation_requested','cancelled');
create type public.cancellation_status as enum ('awaiting_operations','approved','rejected','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'customer',
  vendor_id uuid,
  phone text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  monthly_price numeric(12,2),
  annual_price numeric(12,2),
  gst_percent numeric(5,2) not null default 18,
  trial_days integer not null default 0,
  entitlements jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  vendor_kind text not null default 'subscription' check (vendor_kind in ('subscription','p0_connect')),
  p0_created_by uuid references public.profiles(id) on delete set null,
  p0_cancelled_at timestamptz,
  p0_contact_name text,
  p0_contact_phone text,
  p0_fssai_required boolean not null default false,
  plan_id uuid references public.vendor_plans(id),
  name text not null,
  category text not null,
  description text,
  logo_url text,
  locality text not null,
  pincode text,
  whatsapp_number text,
  operating_hours jsonb,
  latitude numeric,
  longitude numeric,
  service_radius_km numeric(6,2) not null default 5,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  verification_status public.verification_status not null default 'draft',
  operational_status public.operational_status not null default 'inactive',
  marketplace_visible boolean not null default false,
  connect_enabled boolean not null default false,
  billing_status text not null default 'launch_free',
  cut_off_time time not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_kind_owner_plan_check check (
    (vendor_kind='p0_connect' and owner_id is null and plan_id is null)
    or (vendor_kind='subscription' and owner_id is not null)
  )
);
alter table public.profiles add constraint profiles_vendor_fk foreign key (vendor_id) references public.vendors(id) on delete set null;

create table public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  document_type text not null,
  document_number text,
  storage_path text not null,
  issue_date date,
  expiry_date date,
  verification_status public.verification_status not null default 'submitted',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table public.vendor_menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  unit text not null,
  vendor_base_price numeric(12,2) not null check (vendor_base_price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_item_markups (
  menu_item_id uuid primary key references public.vendor_menu_items(id) on delete cascade,
  markup_percent numeric(6,2) not null default 0 check (markup_percent >= 0 and markup_percent <= 100),
  effective_from timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.customer_requirements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  locality text not null,
  delivery_date date not null check (delivery_date > current_date),
  fulfilment_mode text not null check (fulfilment_mode in ('vendor_delivery','self_pickup')),
  quote_deadline timestamptz not null,
  status text not null default 'draft',
  ai_extraction_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_requirement_files (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.requirement_items (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete cascade,
  product_name text not null,
  preferred_brand text,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  substitute_allowed boolean not null default false,
  customer_note text,
  created_at timestamptz not null default now()
);

create table public.rfq_vendor_invitations (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null default 'invited',
  invited_at timestamptz not null default now(),
  viewed_at timestamptz,
  unique(requirement_id,vendor_id)
);

create table public.vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_total numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  operations_markup_percent numeric(6,2) not null default 0 check (operations_markup_percent >= 0 and operations_markup_percent <= 100),
  status text not null default 'draft',
  valid_until timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requirement_id,vendor_id)
);

create table public.vendor_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.vendor_quotes(id) on delete cascade,
  requirement_item_id uuid not null references public.requirement_items(id),
  offered_brand text,
  available boolean not null default true,
  vendor_unit_price numeric(12,2) not null default 0,
  operations_markup_percent numeric(6,2) not null default 0 check (operations_markup_percent >= 0 and operations_markup_percent <= 100),
  created_at timestamptz not null default now(),
  unique(quote_id,requirement_item_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  requirement_id uuid references public.customer_requirements(id),
  quote_id uuid references public.vendor_quotes(id),
  customer_id uuid not null references public.profiles(id),
  vendor_id uuid not null references public.vendors(id),
  vendor_base_total numeric(12,2) not null,
  markup_total numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  customer_total numeric(12,2) not null,
  delivery_address text,
  fulfilment_mode text not null check (fulfilment_mode in ('vendor_delivery','self_pickup','third_party_delivery')),
  scheduled_date date not null check (scheduled_date > current_date),
  scheduled_slot text not null,
  status public.order_status not null default 'awarded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.third_party_delivery_requests (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_notes text not null check (char_length(trim(customer_notes)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','accepted','delivered','expired','locked')),
  accepted_at timestamptz,
  code_hash text,
  code_expires_at timestamptz,
  code_issued_count integer not null default 0 check (code_issued_count between 0 and 5),
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity numeric(12,3) not null,
  unit text not null,
  vendor_base_price numeric(12,2) not null,
  markup_percent numeric(6,2) not null default 0,
  customer_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references public.profiles(id),
  provider text not null default 'razorpay',
  provider_reference text,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references public.profiles(id),
  reason text not null,
  ai_decision text,
  ai_confidence numeric(5,2),
  ai_reason text,
  recommended_refund numeric(12,2),
  status public.cancellation_status not null default 'awaiting_operations',
  operations_decision_by uuid references public.profiles(id),
  operations_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  cancellation_id uuid not null references public.cancellation_requests(id),
  payment_id uuid not null references public.payments(id),
  amount numeric(12,2) not null,
  provider_reference text,
  status text not null default 'pending',
  approved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  agent_type text not null,
  task text not null,
  input_context jsonb not null default '{}',
  recommendation jsonb not null default '{}',
  consequential boolean not null default false,
  approval_status text not null default 'not_required',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  actor_role public.app_role,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.p0_vendor_permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  can_create boolean not null default false,
  can_review boolean not null default false,
  can_cancel boolean not null default false,
  can_reactivate boolean not null default false,
  can_upgrade boolean not null default false,
  can_upload boolean not null default false,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now()
);

create table public.p0_upgrade_invitations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  invited_email text not null,
  plan_id uuid not null references public.vendor_plans(id),
  invited_by uuid not null references public.profiles(id),
  provider_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','sent','claim_pending','delivery_failed','revoked','expired','completed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index p0_one_live_upgrade_invitation
on public.p0_upgrade_invitations(vendor_id)
where status in ('pending','sent','claim_pending','delivery_failed');

create table public.p0_vendor_history (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.vendors(id),
  historical_whatsapp_number text not null,
  reason text not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now()
);

create table public.vendor_whatsapp_click_events (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('map','vendor_profile','search')),
  created_at timestamptz not null default now()
);

create index vendor_status_idx on public.vendors(verification_status,operational_status,marketplace_visible);
create index menu_vendor_active_idx on public.vendor_menu_items(vendor_id,active);
create index idx_vendor_whatsapp_click_events_vendor_created on public.vendor_whatsapp_click_events(vendor_id,created_at desc);
create index idx_vendor_whatsapp_click_events_source_created on public.vendor_whatsapp_click_events(source,created_at desc);
create index requirement_customer_idx on public.customer_requirements(customer_id,status);
create index invitation_vendor_idx on public.rfq_vendor_invitations(vendor_id,status);
create index quote_requirement_idx on public.vendor_quotes(requirement_id,status);
create index order_customer_idx on public.orders(customer_id,status);
create index order_vendor_idx on public.orders(vendor_id,status);
create index cancellation_status_idx on public.cancellation_requests(status,created_at);

create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid()
$$;

create or replace function public.owns_vendor(target_vendor uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.vendors where id=target_vendor and owner_id=auth.uid())
$$;

create or replace function public.p0_actor_can(p_actor uuid, p_action text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.profiles p
    where p.id=p_actor
      and (
        p.role='admin'
        or (
          p.role='operations'
          and exists (
            select 1
            from public.p0_vendor_permissions permission
            where permission.profile_id=p.id
              and case p_action
                when 'create' then permission.can_create
                when 'review' then permission.can_review
                when 'cancel' then permission.can_cancel
                when 'reactivate' then permission.can_reactivate
                when 'upgrade' then permission.can_upgrade
                when 'upload' then permission.can_upload
                else false
              end
          )
        )
      )
  )
$$;

create or replace function public.p0_current_actor_can(p_action text) returns boolean
language sql stable security definer set search_path=public as $$
  select public.p0_actor_can(auth.uid(),p_action)
$$;

revoke all on function public.p0_actor_can(uuid,text) from public,anon,authenticated;
grant execute on function public.p0_actor_can(uuid,text) to service_role;
revoke all on function public.p0_current_actor_can(text) from public;
grant execute on function public.p0_current_actor_can(text) to anon,authenticated;

create or replace function public.marketplace_menu()
returns table(item_id uuid,vendor_id uuid,vendor_name text,item_name text,category text,unit text,image_url text,customer_price numeric)
language sql stable security definer set search_path=public as $$
  select i.id,v.id,v.name,i.name,i.category,i.unit,i.image_url,
    round(i.vendor_base_price*(1+coalesce(m.markup_percent,0)/100),2)
  from public.vendor_menu_items i
  join public.vendors v on v.id=i.vendor_id
  left join public.vendor_item_markups m on m.menu_item_id=i.id
  where i.active=true and v.vendor_kind='subscription' and v.verification_status='verified' and v.operational_status='active' and v.marketplace_visible=true
$$;
grant execute on function public.marketplace_menu() to anon,authenticated;

drop function if exists public.connect_vendors_nearby(double precision,double precision);
create function public.connect_vendors_nearby(customer_lat double precision, customer_lng double precision)
returns table(
  vendor_kind text,vendor_id uuid,vendor_name text,category text,description text,locality text,address text,
  latitude double precision,longitude double precision,whatsapp_number text,operating_hours jsonb,
  logo_url text,distance_km double precision,service_radius_km numeric,store_open_today boolean
)
language sql stable security definer set search_path=pg_catalog,public as $$
  select v.vendor_kind::text,v.id,v.name,v.category,v.description,v.locality,v.address,v.latitude::double precision,
    v.longitude::double precision,v.whatsapp_number,v.operating_hours,v.logo_url,d.distance_km,
    v.service_radius_km,v.store_open_today
  from public.vendors v
  cross join lateral (
    select 6371.0*2*asin(sqrt(least(1.0,greatest(0.0,
      power(sin(radians(v.latitude::double precision-customer_lat)/2),2)
      +cos(radians(customer_lat))*cos(radians(v.latitude::double precision))
      *power(sin(radians(v.longitude::double precision-customer_lng)/2),2)
    )))) as distance_km
  ) d
  where customer_lat between -90 and 90 and customer_lng between -180 and 180
    and v.vendor_kind='p0_connect' and v.connect_enabled
    and v.verification_status='verified' and v.operational_status='active'
    and v.marketplace_visible and v.p0_cancelled_at is null
    and v.latitude between -90 and 90 and v.longitude between -180 and 180
    and v.whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
    and d.distance_km<=v.service_radius_km
  order by d.distance_km
$$;

create or replace function public.track_vendor_whatsapp_click(target_vendor_id uuid, click_source text)
returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  new_event_id uuid;
  current_customer_id uuid := auth.uid();
begin
  if click_source is null or click_source not in ('map','vendor_profile','search') then
    raise exception 'Invalid WhatsApp click source';
  end if;
  if current_customer_id is null or public.current_app_role() is distinct from 'customer'::public.app_role then
    raise exception 'Only authenticated customers may record WhatsApp contact clicks';
  end if;
  if not exists (
    select 1 from public.vendors v
    where v.id=target_vendor_id and v.vendor_kind='p0_connect' and v.connect_enabled
      and v.verification_status='verified' and v.operational_status='active'
      and v.marketplace_visible and v.p0_cancelled_at is null
      and v.latitude between -90 and 90 and v.longitude between -180 and 180
      and v.whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ) then raise exception 'Vendor is not available for Connect contact'; end if;

  insert into public.vendor_whatsapp_click_events(vendor_id,customer_id,source)
  values(target_vendor_id,current_customer_id,click_source)
  returning id into new_event_id;
  return new_event_id;
end
$$;

create or replace function public.marketplace_menu_nearby(customer_lat double precision, customer_lng double precision)
returns table(
  item_id uuid,vendor_id uuid,vendor_name text,item_name text,category text,unit text,
  quantity_step numeric,stock_quantity numeric,image_url text,customer_price numeric,
  calories_per_unit numeric,protein_g numeric,carbs_g numeric,fat_g numeric,fibre_g numeric,
  dietary_tags text[],pack_amount numeric,pack_measure text,delivery_enabled boolean,
  pickup_enabled boolean,distance_km numeric,vendor_lat double precision,vendor_lng double precision,
  vendor_plan_code text
)
language sql stable security definer set search_path=pg_catalog,public as $$
  with eligible as (
    select item.id as item_id,vendor.id as vendor_id,vendor.name as vendor_name,
      item.name as item_name,item.category,item.unit,item.quantity_step,item.stock_quantity,item.image_url,
      round(item.vendor_base_price*(1+coalesce(markup.markup_percent,0)/100),2) as customer_price,
      item.calories_per_unit,item.protein_g,item.carbs_g,item.fat_g,item.fibre_g,item.dietary_tags,
      item.pack_amount,item.pack_measure,vendor.delivery_enabled,vendor.pickup_enabled,
      vendor.service_radius_km,vendor.latitude::double precision as vendor_lat,
      vendor.longitude::double precision as vendor_lng,coalesce(plan.code,'crave') as vendor_plan_code,
      6371*2*asin(sqrt(
        power(sin(radians((vendor.latitude::double precision-customer_lat)/2)),2)
        +cos(radians(customer_lat))*cos(radians(vendor.latitude::double precision))
        *power(sin(radians((vendor.longitude::double precision-customer_lng)/2)),2)
      )) as calculated_distance_km
    from public.vendor_menu_items item
    join public.vendors vendor on vendor.id=item.vendor_id
    left join public.vendor_item_markups markup on markup.menu_item_id=item.id
    left join public.vendor_plans plan on plan.id=vendor.plan_id
    where customer_lat between -90 and 90 and customer_lng between -180 and 180
      and vendor.vendor_kind='subscription'
      and vendor.latitude is not null and vendor.longitude is not null
      and vendor.latitude between -90 and 90 and vendor.longitude between -180 and 180
      and item.active and item.stock_quantity>0
      and vendor.verification_status='verified' and vendor.operational_status='active'
      and vendor.marketplace_visible and vendor.store_open_today
      and (vendor.delivery_enabled or vendor.pickup_enabled)
  )
  select item_id,vendor_id,vendor_name,item_name,category,unit,quantity_step,stock_quantity,image_url,
    customer_price,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,pack_amount,
    pack_measure,delivery_enabled,pickup_enabled,round(calculated_distance_km::numeric,2),
    vendor_lat,vendor_lng,vendor_plan_code
  from eligible
  where calculated_distance_km<=service_radius_km
  order by calculated_distance_km,item_name
$$;

revoke all on function public.connect_vendors_nearby(double precision,double precision) from public;
grant execute on function public.connect_vendors_nearby(double precision,double precision) to anon,authenticated;
revoke all on function public.track_vendor_whatsapp_click(uuid,text) from public,anon;
grant execute on function public.track_vendor_whatsapp_click(uuid,text) to authenticated;
revoke all on function public.marketplace_menu_nearby(double precision,double precision) from public,anon;
grant execute on function public.marketplace_menu_nearby(double precision,double precision) to authenticated;

-- Customers compare only the final sell price. Raw vendor cost and Operations
-- percentage stay in the sealed quote tables and are not directly customer-readable.
create or replace function public.customer_quote_comparison(target_requirement uuid)
returns table(quote_id uuid,vendor_id uuid,vendor_name text,quote_status text,coverage_percent numeric,customer_total numeric,delivery_fee numeric,tax_amount numeric,valid_until timestamptz)
language sql stable security definer set search_path=public as $$
  select q.id,q.vendor_id,v.name,q.status,
    round(100.0*count(qi.id) filter(where qi.available)/nullif(count(qi.id),0),0),
    round(q.vendor_total*(1+q.operations_markup_percent/100)+q.delivery_fee+q.tax_amount,2),
    q.delivery_fee,q.tax_amount,q.valid_until
  from public.vendor_quotes q
  join public.customer_requirements r on r.id=q.requirement_id
  join public.vendors v on v.id=q.vendor_id
  left join public.vendor_quote_items qi on qi.quote_id=q.id
  where q.requirement_id=target_requirement and r.customer_id=auth.uid() and q.status<>'draft'
  group by q.id,v.id
$$;
grant execute on function public.customer_quote_comparison(uuid) to authenticated;

create or replace function public.customer_quote_items(target_quote uuid)
returns table(quote_item_id uuid,product_name text,offered_brand text,available boolean,quantity numeric,unit text,customer_unit_price numeric)
language sql stable security definer set search_path=public as $$
  select qi.id,ri.product_name,qi.offered_brand,qi.available,ri.quantity,ri.unit,
    round(qi.vendor_unit_price*(1+coalesce(nullif(qi.operations_markup_percent,0),q.operations_markup_percent)/100),2)
  from public.vendor_quote_items qi
  join public.vendor_quotes q on q.id=qi.quote_id
  join public.customer_requirements r on r.id=q.requirement_id
  join public.requirement_items ri on ri.id=qi.requirement_item_id
  where qi.quote_id=target_quote and r.customer_id=auth.uid() and q.status<>'draft'
$$;
grant execute on function public.customer_quote_items(uuid) to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_user_meta_data->>'role'='vendor' then 'vendor'::public.app_role else 'customer'::public.app_role end);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS controls which rows are reachable. These guards additionally protect
-- privileged columns inside rows a customer or vendor is otherwise allowed to edit.
create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and new.vendor_id is distinct from old.vendor_id and new.vendor_id is not null and
    exists(select 1 from public.vendors v where v.id=new.vendor_id and v.vendor_kind='p0_connect') then
    raise exception 'P0 ownership must be established through the authorized upgrade flow';
  end if;
  if auth.uid() is not null and public.current_app_role()<>'admin' then
    new.role:=old.role;
    if not (
      old.role='vendor' and old.vendor_id is null and new.vendor_id is not null and
      exists(select 1 from public.vendors v where v.id=new.vendor_id and v.vendor_kind='subscription' and v.owner_id=auth.uid())
    ) then new.vendor_id:=old.vendor_id; end if;
  end if;
  return new;
end; $$;
create trigger guard_profile_privileges before update on public.profiles for each row execute function public.guard_profile_privileges();

create or replace function public.guard_vendor_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='vendor' then
    if tg_op='INSERT' then
      if new.verification_status not in ('draft','submitted') then new.verification_status:='draft'; end if;
      new.operational_status:='inactive';
      new.marketplace_visible:=false;
      new.billing_status:='launch_free';
      new.plan_id:=null;
    else
      new.owner_id:=old.owner_id;
      new.plan_id:=old.plan_id;
      new.verification_status:=old.verification_status;
      new.operational_status:=old.operational_status;
      new.marketplace_visible:=old.marketplace_visible;
      new.billing_status:=old.billing_status;
    end if;
  end if;
  return new;
end; $$;
create trigger guard_vendor_privileges before insert or update on public.vendors for each row execute function public.guard_vendor_privileges();

create or replace function public.guard_document_verification() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='vendor' then
    new.verification_status:='submitted';
    new.reviewed_by:=null;
    new.reviewed_at:=null;
    new.review_note:=null;
  end if;
  return new;
end; $$;
create trigger guard_document_verification before insert or update on public.vendor_documents for each row execute function public.guard_document_verification();

create or replace function public.guard_quote_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='vendor' then
    if tg_op='INSERT' then
      new.operations_markup_percent:=0;
      if new.status not in ('draft','submitted') then raise exception 'Vendor quote status is not permitted'; end if;
    else
      new.requirement_id:=old.requirement_id;
      new.vendor_id:=old.vendor_id;
      new.operations_markup_percent:=old.operations_markup_percent;
      if new.status not in ('draft','submitted','withdrawn') then raise exception 'Vendor quote status is not permitted'; end if;
    end if;
  elsif auth.uid() is not null and public.current_app_role()='operations' and tg_op='UPDATE' then
    new.requirement_id:=old.requirement_id;
    new.vendor_id:=old.vendor_id;
    new.vendor_total:=old.vendor_total;
    new.delivery_fee:=old.delivery_fee;
    new.tax_amount:=old.tax_amount;
    new.valid_until:=old.valid_until;
    new.submitted_at:=old.submitted_at;
  end if;
  return new;
end; $$;
create trigger guard_quote_privileges before insert or update on public.vendor_quotes for each row execute function public.guard_quote_privileges();

create or replace function public.guard_quote_item_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='vendor' then
    if tg_op='INSERT' then new.operations_markup_percent:=0;
    else
      new.quote_id:=old.quote_id;
      new.requirement_item_id:=old.requirement_item_id;
      new.operations_markup_percent:=old.operations_markup_percent;
    end if;
  elsif auth.uid() is not null and public.current_app_role()='operations' and tg_op='UPDATE' then
    new.quote_id:=old.quote_id;
    new.requirement_item_id:=old.requirement_item_id;
    new.offered_brand:=old.offered_brand;
    new.available:=old.available;
    new.vendor_unit_price:=old.vendor_unit_price;
  end if;
  return new;
end; $$;
create trigger guard_quote_item_privileges before insert or update on public.vendor_quote_items for each row execute function public.guard_quote_item_privileges();

create or replace function public.guard_order_financials() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role() in ('vendor','operations') then
    new.order_number:=old.order_number;
    new.requirement_id:=old.requirement_id;
    new.quote_id:=old.quote_id;
    new.customer_id:=old.customer_id;
    new.vendor_id:=old.vendor_id;
    new.vendor_base_total:=old.vendor_base_total;
    new.markup_total:=old.markup_total;
    new.tax_amount:=old.tax_amount;
    new.delivery_fee:=old.delivery_fee;
    new.customer_total:=old.customer_total;
    new.fulfilment_mode:=old.fulfilment_mode;
    new.scheduled_date:=old.scheduled_date;
    new.scheduled_slot:=old.scheduled_slot;
  end if;
  if auth.uid() is not null and public.current_app_role()='vendor' then
    if new.status not in ('confirmed','preparing','ready','out_for_delivery','ready_for_pickup','completed') then
      raise exception 'Vendor order status is not permitted';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_order_financials before update on public.orders for each row execute function public.guard_order_financials();

create or replace function public.guard_cancellation_submission() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='customer' then
    new.ai_decision:=null;
    new.ai_confidence:=null;
    new.ai_reason:=null;
    new.recommended_refund:=null;
    new.status:='awaiting_operations';
    new.operations_decision_by:=null;
    new.operations_note:=null;
    new.decided_at:=null;
  end if;
  return new;
end; $$;
create trigger guard_cancellation_submission before insert on public.cancellation_requests for each row execute function public.guard_cancellation_submission();

create or replace function public.guard_cancellation_decision() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role()='operations' then
    new.order_id:=old.order_id;
    new.customer_id:=old.customer_id;
    new.reason:=old.reason;
    new.ai_decision:=old.ai_decision;
    new.ai_confidence:=old.ai_confidence;
    new.ai_reason:=old.ai_reason;
    new.recommended_refund:=old.recommended_refund;
  end if;
  return new;
end; $$;
create trigger guard_cancellation_decision before update on public.cancellation_requests for each row execute function public.guard_cancellation_decision();

alter table public.profiles enable row level security;
alter table public.vendor_plans enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_documents enable row level security;
alter table public.vendor_menu_items enable row level security;
alter table public.vendor_item_markups enable row level security;
alter table public.customer_requirements enable row level security;
alter table public.customer_requirement_files enable row level security;
alter table public.requirement_items enable row level security;
alter table public.rfq_vendor_invitations enable row level security;
alter table public.vendor_quotes enable row level security;
alter table public.vendor_quote_items enable row level security;
alter table public.orders enable row level security;
alter table public.third_party_delivery_requests enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.payment_reversals enable row level security;
alter table public.ai_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.p0_vendor_permissions enable row level security;
alter table public.p0_upgrade_invitations enable row level security;
alter table public.p0_vendor_history enable row level security;
alter table public.vendor_whatsapp_click_events enable row level security;

revoke all on table public.p0_vendor_permissions, public.p0_upgrade_invitations, public.p0_vendor_history
  from public, anon, authenticated;
revoke all on table public.vendor_whatsapp_click_events from public, anon, authenticated;

create policy profiles_read on public.profiles for select using (id=auth.uid() or public.current_app_role() in ('operations','admin'));
create policy profiles_update_self on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy profiles_admin_update on public.profiles for update using (public.current_app_role()='admin') with check (public.current_app_role()='admin');
create policy plans_authenticated_read on public.vendor_plans for select to authenticated using (active or public.current_app_role()='admin');
create policy plans_admin_write on public.vendor_plans for all using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

create policy vendors_customer_read on public.vendors for select using (
  (vendor_kind='subscription' and (
    (verification_status='verified' and operational_status='active' and marketplace_visible)
    or owner_id=auth.uid() or public.current_app_role() in ('operations','admin')
  ))
  or (vendor_kind='p0_connect' and (
    public.current_app_role()='admin'
    or (public.current_app_role()='operations' and (
      public.p0_current_actor_can('create') or public.p0_current_actor_can('review')
      or public.p0_current_actor_can('cancel') or public.p0_current_actor_can('reactivate')
      or public.p0_current_actor_can('upgrade') or public.p0_current_actor_can('upload')
    ))
  ))
);
create policy vendors_owner_insert on public.vendors for insert
with check (vendor_kind='subscription' and owner_id=auth.uid() and public.current_app_role()='vendor');
create policy vendors_owner_draft_update on public.vendors for update
using (vendor_kind='subscription' and (owner_id=auth.uid() or public.current_app_role() in ('operations','admin')))
with check (vendor_kind='subscription' and (owner_id=auth.uid() or public.current_app_role() in ('operations','admin')));
create policy vendors_operations_insert on public.vendors for insert
with check (vendor_kind='subscription' and owner_id is not null and public.current_app_role() in ('operations','admin'));
create policy documents_vendor_ops_read on public.vendor_documents for select using (
  public.owns_vendor(vendor_id)
  or (public.current_app_role() in ('operations','admin') and (
    exists(select 1 from public.vendors v where v.id=vendor_id and v.vendor_kind='subscription')
    or public.current_app_role()='admin'
    or (public.current_app_role()='operations' and (public.p0_current_actor_can('review') or public.p0_current_actor_can('upload')))
  ))
);
create policy documents_vendor_insert on public.vendor_documents for insert with check (public.owns_vendor(vendor_id));
create policy documents_ops_update on public.vendor_documents for update
using (exists(select 1 from public.vendors v where v.id=vendor_id and (
  (v.vendor_kind='subscription' and public.current_app_role() in ('operations','admin'))
  or (v.vendor_kind='p0_connect' and (public.current_app_role()='admin' or (public.current_app_role()='operations' and public.p0_current_actor_can('review')))
)))
with check (exists(select 1 from public.vendors v where v.id=vendor_id and (
  (v.vendor_kind='subscription' and public.current_app_role() in ('operations','admin'))
  or (v.vendor_kind='p0_connect' and (public.current_app_role()='admin' or (public.current_app_role()='operations' and public.p0_current_actor_can('review')))
)));

create policy menu_vendor_all on public.vendor_menu_items for all using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));
create policy menu_ops_admin_read on public.vendor_menu_items for select using (public.current_app_role() in ('operations','admin'));
create policy menu_admin_write on public.vendor_menu_items for all using (public.current_app_role()='admin') with check (public.current_app_role()='admin');
create policy markup_ops_admin on public.vendor_item_markups for all using (public.current_app_role() in ('operations','admin')) with check (public.current_app_role() in ('operations','admin'));

create policy requirements_customer_ops_read on public.customer_requirements for select using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin') or exists(select 1 from public.rfq_vendor_invitations i where i.requirement_id=id and public.owns_vendor(i.vendor_id)));
create policy requirements_customer_insert on public.customer_requirements for insert with check (customer_id=auth.uid());
create policy requirements_customer_update on public.customer_requirements for update using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin'));
create policy requirement_items_access on public.requirement_items for select using (exists(select 1 from public.customer_requirements r where r.id=requirement_id and (r.customer_id=auth.uid() or public.current_app_role() in ('operations','admin') or exists(select 1 from public.rfq_vendor_invitations i where i.requirement_id=r.id and public.owns_vendor(i.vendor_id)))));
create policy requirement_items_customer_write on public.requirement_items for all using (exists(select 1 from public.customer_requirements r where r.id=requirement_id and r.customer_id=auth.uid())) with check (exists(select 1 from public.customer_requirements r where r.id=requirement_id and r.customer_id=auth.uid()));
create policy requirement_files_owner_ops on public.customer_requirement_files for all
using (uploaded_by=auth.uid() or public.current_app_role() in ('operations','admin'))
with check (public.current_app_role() in ('operations','admin') or (uploaded_by=auth.uid() and exists(select 1 from public.customer_requirements r where r.id=requirement_id and r.customer_id=auth.uid())));

create policy invitations_vendor_ops_read on public.rfq_vendor_invitations for select using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
create policy invitations_ops_write on public.rfq_vendor_invitations for all using (public.current_app_role() in ('operations','admin')) with check (public.current_app_role() in ('operations','admin'));
create policy quotes_sealed_access on public.vendor_quotes for select using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
create policy quotes_vendor_write on public.vendor_quotes for all using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id) and exists(select 1 from public.rfq_vendor_invitations i where i.requirement_id=vendor_quotes.requirement_id and i.vendor_id=vendor_quotes.vendor_id));
create policy quotes_ops_update on public.vendor_quotes for update using (public.current_app_role() in ('operations','admin'));
create policy quote_items_sealed_access on public.vendor_quote_items for select using (exists(select 1 from public.vendor_quotes q where q.id=quote_id and (public.owns_vendor(q.vendor_id) or public.current_app_role() in ('operations','admin'))));
create policy quote_items_vendor_write on public.vendor_quote_items for all using (exists(select 1 from public.vendor_quotes q where q.id=quote_id and public.owns_vendor(q.vendor_id))) with check (exists(select 1 from public.vendor_quotes q where q.id=quote_id and public.owns_vendor(q.vendor_id)));

create policy orders_party_read on public.orders for select using (customer_id=auth.uid() or public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
-- Orders are created only by a server-side award/payment function using the service role.
-- No direct authenticated insert policy is intentionally granted.
create policy orders_vendor_ops_update on public.orders for update using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
revoke all on table public.third_party_delivery_requests from public, anon, authenticated;
grant select (order_id, customer_id, vendor_id, customer_notes, status, accepted_at, code_expires_at, code_issued_count, delivered_at, created_at, updated_at)
  on public.third_party_delivery_requests to authenticated;
create policy third_party_delivery_party_read on public.third_party_delivery_requests for select
using (customer_id=auth.uid() or public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
create policy order_items_party_read on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.owns_vendor(o.vendor_id) or public.current_app_role() in ('operations','admin'))));
create policy payments_customer_ops_read on public.payments for select using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin'));
create policy cancellations_party_read on public.cancellation_requests for select using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin') or exists(select 1 from public.orders o where o.id=order_id and public.owns_vendor(o.vendor_id)));
create policy cancellations_customer_insert on public.cancellation_requests for insert
with check (customer_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy cancellations_ops_update on public.cancellation_requests for update using (public.current_app_role() in ('operations','admin'));
create policy reversals_ops_admin on public.payment_reversals for all using (public.current_app_role() in ('operations','admin')) with check (public.current_app_role() in ('operations','admin'));
create policy ai_actions_actor_ops on public.ai_actions for select using (actor_id=auth.uid() or public.current_app_role() in ('operations','admin'));
create policy ai_actions_actor_insert on public.ai_actions for insert with check (actor_id=auth.uid());
create policy audit_ops_admin on public.audit_logs for select using (public.current_app_role() in ('operations','admin'));
create policy audit_actor_insert on public.audit_logs for insert with check (actor_id=auth.uid() or public.current_app_role() in ('operations','admin'));

insert into storage.buckets(id,name,public) values ('vendor-certificates','vendor-certificates',false) on conflict do nothing;
insert into storage.buckets(id,name,public) values ('customer-requirements','customer-requirements',false) on conflict do nothing;
create policy vendor_certificate_upload on storage.objects for insert to authenticated with check (bucket_id='vendor-certificates' and (storage.foldername(name))[1]=auth.uid()::text and public.current_app_role()='vendor');
create policy vendor_certificate_read on storage.objects for select to authenticated
using (bucket_id='vendor-certificates' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or public.current_app_role()='admin'
  or (public.current_app_role()='operations' and (
    not exists(select 1 from public.vendors v where v.id::text=(storage.foldername(name))[1] and v.vendor_kind='p0_connect')
    or public.p0_current_actor_can('review') or public.p0_current_actor_can('upload')
  ))
));
create policy requirement_file_owner on storage.objects for all to authenticated using (bucket_id='customer-requirements' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_app_role() in ('operations','admin'))) with check (bucket_id='customer-requirements' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_app_role() in ('operations','admin')));

insert into public.vendor_plans(code,name,monthly_price,annual_price,entitlements) values
('taster','Taster',499,null,'{"catalogue":true,"inventory":true,"scheduled_orders":false,"ordering":false,"whatsapp_leads":true,"food_stories":false,"food_drops":false,"rfq_access":false,"ai_quotes":false}'),
('crave','Crave',699,null,'{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":false,"rfq_access":false,"ai_quotes":false}'),
('thrive','Thrive',799,null,'{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":true,"rfq_access":false,"ai_quotes":false}'),
('crown','Crown',999,null,'{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":true,"rfq_access":true,"ai_quotes":true,"priority_alerts":true}')
on conflict(code) do nothing;

-- Create Operations and Admin accounts in Supabase Authentication, then update their profile roles manually.
-- Never allow a public signup request to assign operations or admin roles.