-- ShePlates V3 upgrade for an existing V2 Supabase project.
-- Run this once in Supabase SQL Editor after supabase/schema.sql.
-- Safe to re-run: tables/columns/indexes are created conditionally and policies are replaced.

alter table public.vendors add column if not exists address text;
alter table public.vendors add column if not exists store_open_today boolean not null default false;
alter table public.vendors add column if not exists radius_updated_at timestamptz not null default now();
alter table public.vendor_menu_items add column if not exists quantity_step numeric(12,3) not null default 1 check (quantity_step > 0);
alter table public.vendor_menu_items add column if not exists stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0);
alter table public.vendor_menu_items add column if not exists calories_per_unit numeric(12,2) not null default 0 check (calories_per_unit >= 0);
alter table public.vendor_menu_items add column if not exists protein_g numeric(12,2) not null default 0 check (protein_g >= 0);
alter table public.vendor_menu_items add column if not exists carbs_g numeric(12,2) not null default 0 check (carbs_g >= 0);
alter table public.vendor_menu_items add column if not exists fat_g numeric(12,2) not null default 0 check (fat_g >= 0);
alter table public.vendor_menu_items add column if not exists fibre_g numeric(12,2) not null default 0 check (fibre_g >= 0);
alter table public.vendor_menu_items add column if not exists dietary_tags text[] not null default '{}';
alter table public.orders add column if not exists schedule_id uuid;

create table if not exists public.customer_preferences (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null,
  latitude numeric,
  longitude numeric,
  household_size integer not null default 1 check (household_size between 1 and 50),
  diet text not null default 'No preference',
  allergies text[] not null default '{}',
  health_goals text[] not null default '{}',
  dislikes_and_instructions text not null default '',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_schedules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  menu_item_id uuid not null references public.vendor_menu_items(id) on delete cascade,
  start_date date not null check (start_date > current_date),
  end_date date,
  recurrence text not null check (recurrence in ('once','daily','weekly','custom')),
  weekdays smallint[] not null default '{}',
  scheduled_slot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  fulfilment_mode text not null check (fulfilment_mode in ('vendor_delivery','self_pickup')),
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

do $$ begin
  alter table public.orders add constraint orders_schedule_fk foreign key (schedule_id) references public.product_schedules(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.vendor_daily_service_settings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  service_date date not null default current_date,
  store_open boolean not null default false,
  service_radius_km numeric(6,2) not null check (service_radius_km between 0.5 and 100),
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(vendor_id,service_date),
  check (delivery_enabled or pickup_enabled)
);

create table if not exists public.vendor_delivery_staff (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  full_name text not null,
  phone text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vendor_id,phone)
);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  delivery_staff_id uuid not null references public.vendor_delivery_staff(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_role public.app_role not null,
  title text not null default 'She Agent conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  message_role text not null check (message_role in ('user','assistant','tool')),
  content text not null,
  safe_context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists product_schedule_customer_idx on public.product_schedules(customer_id,status,start_date);
create index if not exists product_schedule_vendor_idx on public.product_schedules(vendor_id,status,start_date);
create index if not exists service_setting_vendor_date_idx on public.vendor_daily_service_settings(vendor_id,service_date);
create index if not exists delivery_staff_vendor_idx on public.vendor_delivery_staff(vendor_id,active);
create index if not exists notification_recipient_idx on public.notifications(recipient_id,read_at,created_at desc);
create index if not exists agent_conversation_actor_idx on public.agent_conversations(actor_id,updated_at desc);

alter table public.customer_preferences enable row level security;
alter table public.product_schedules enable row level security;
alter table public.vendor_daily_service_settings enable row level security;
alter table public.vendor_delivery_staff enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;

drop policy if exists customer_preferences_access on public.customer_preferences;
create policy customer_preferences_access on public.customer_preferences for all
using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin'))
with check (customer_id=auth.uid() or public.current_app_role()='admin');

drop policy if exists schedules_party_read on public.product_schedules;
create policy schedules_party_read on public.product_schedules for select
using (customer_id=auth.uid() or public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
drop policy if exists schedules_customer_insert on public.product_schedules;
create policy schedules_customer_insert on public.product_schedules for insert
with check (customer_id=auth.uid() and exists (
  select 1 from public.vendor_menu_items item join public.vendors vendor on vendor.id=item.vendor_id
  where item.id=menu_item_id and item.vendor_id=product_schedules.vendor_id and item.active
  and vendor.verification_status='verified' and vendor.operational_status='active'
  and vendor.marketplace_visible and vendor.store_open_today
));
drop policy if exists schedules_customer_update on public.product_schedules;
create policy schedules_customer_update on public.product_schedules for update
using (customer_id=auth.uid()) with check (customer_id=auth.uid());

drop policy if exists service_settings_access on public.vendor_daily_service_settings;
create policy service_settings_access on public.vendor_daily_service_settings for all
using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'))
with check ((public.owns_vendor(vendor_id) and updated_by=auth.uid()) or public.current_app_role() in ('operations','admin'));

drop policy if exists delivery_staff_access on public.vendor_delivery_staff;
create policy delivery_staff_access on public.vendor_delivery_staff for all
using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'))
with check (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));

drop policy if exists delivery_assignments_party on public.delivery_assignments;
create policy delivery_assignments_party on public.delivery_assignments for select
using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin') or exists (
  select 1 from public.orders target where target.id=order_id and target.customer_id=auth.uid()
));
drop policy if exists delivery_assignments_vendor_ops_write on public.delivery_assignments;
create policy delivery_assignments_vendor_ops_write on public.delivery_assignments for all
using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'))
with check ((public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin')) and exists (
  select 1 from public.vendor_delivery_staff staff where staff.id=delivery_staff_id and staff.vendor_id=delivery_assignments.vendor_id
));

drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for select using (recipient_id=auth.uid());
drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications for update using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
-- Notification creation is server-side only; no direct authenticated INSERT policy.

drop policy if exists push_subscriptions_self on public.push_subscriptions;
create policy push_subscriptions_self on public.push_subscriptions for all
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists agent_conversations_self on public.agent_conversations;
create policy agent_conversations_self on public.agent_conversations for all
using (actor_id=auth.uid()) with check (actor_id=auth.uid() and actor_role=public.current_app_role());
drop policy if exists agent_messages_self on public.agent_messages;
create policy agent_messages_self on public.agent_messages for select using (actor_id=auth.uid() and exists (
  select 1 from public.agent_conversations conversation where conversation.id=conversation_id and conversation.actor_id=auth.uid()
));
drop policy if exists agent_messages_self_insert on public.agent_messages;
create policy agent_messages_self_insert on public.agent_messages for insert with check (actor_id=auth.uid() and exists (
  select 1 from public.agent_conversations conversation where conversation.id=conversation_id and conversation.actor_id=auth.uid()
));

drop policy if exists vendors_operations_insert on public.vendors;
create policy vendors_operations_insert on public.vendors for insert
with check (public.current_app_role() in ('operations','admin'));

drop policy if exists vendor_certificate_operations_upload on storage.objects;
create policy vendor_certificate_operations_upload on storage.objects for insert to authenticated
with check (bucket_id='vendor-certificates' and public.current_app_role() in ('operations','admin'));

-- Customer marketplace RPC: only final sell price is exposed. Vendor base prices and
-- markup percentages never leave Operations/Admin/vendor ownership scope.
drop function if exists public.marketplace_menu();
create function public.marketplace_menu()
returns table(item_id uuid,vendor_id uuid,vendor_name text,item_name text,category text,unit text,quantity_step numeric,image_url text,customer_price numeric,calories_per_unit numeric,protein_g numeric,carbs_g numeric,fat_g numeric,fibre_g numeric,dietary_tags text[])
language sql stable security definer set search_path=public as $$
  select item.id,vendor.id,vendor.name,item.name,item.category,item.unit,item.quantity_step,item.image_url,
    round(item.vendor_base_price*(1+coalesce(markup.markup_percent,0)/100),2),
    item.calories_per_unit,item.protein_g,item.carbs_g,item.fat_g,item.fibre_g,item.dietary_tags
  from public.vendor_menu_items item
  join public.vendors vendor on vendor.id=item.vendor_id
  left join public.vendor_item_markups markup on markup.menu_item_id=item.id
  where item.active and vendor.verification_status='verified' and vendor.operational_status='active'
    and vendor.marketplace_visible and vendor.store_open_today
$$;
grant execute on function public.marketplace_menu() to anon,authenticated;

