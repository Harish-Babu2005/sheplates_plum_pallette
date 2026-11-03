-- ShePlates V4: storefronts, customer addresses, carts, RFQ participation,
-- schedule controls, tracking, support tickets and durable notifications.
-- Run after supabase/schema.sql and supabase/V3_UPGRADE.sql.

alter table public.profiles add column if not exists phone text;
alter table public.vendors add column if not exists logo_url text;
alter table public.vendors add column if not exists banner_url text;
alter table public.customer_requirements add column if not exists source_file_name text;
alter table public.rfq_vendor_invitations add column if not exists responded_at timestamptz;
alter table public.product_schedules add column if not exists next_delivery_at timestamptz;
alter table public.product_schedules add column if not exists whatsapp_reminder_enabled boolean not null default true;
alter table public.product_schedules add column if not exists paused_at timestamptz;
alter table public.product_schedules add column if not exists rescheduled_from date;
alter table public.orders add column if not exists tracking_status text not null default 'not_started';
alter table public.orders add column if not exists tracking_latitude double precision;
alter table public.orders add column if not exists tracking_longitude double precision;
alter table public.orders add column if not exists preparation_started_at timestamptz;
alter table public.orders add column if not exists cancellation_fee numeric(12,2) not null default 0 check (cancellation_fee >= 0);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_default_customer_address
on public.customer_addresses(customer_id) where is_default;

create table if not exists public.vendor_outlets (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  service_radius_km numeric(6,2) not null default 5 check (service_radius_km between .5 and 100),
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  open_today boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (delivery_enabled or pickup_enabled)
);

create table if not exists public.commerce_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','confirmed','converted','abandoned')),
  created_by text not null default 'customer' check (created_by in ('customer','she_agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.commerce_carts(id) on delete cascade,
  menu_item_id uuid not null references public.vendor_menu_items(id),
  vendor_id uuid not null references public.vendors(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null check (status in ('preparing','ready','out_for_delivery','arriving','delivered')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  note text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('TKT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  created_by uuid not null references public.profiles(id),
  creator_role public.app_role not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  subject text not null,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_on_user','resolved','closed')),
  assigned_to uuid references public.profiles(id),
  created_via text not null default 'portal' check (created_via in ('portal','she_agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  attachment_name text,
  attachment_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','push','in_app')),
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.customer_addresses enable row level security;
alter table public.vendor_outlets enable row level security;
alter table public.commerce_carts enable row level security;
alter table public.commerce_cart_items enable row level security;
alter table public.delivery_tracking_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.communication_outbox enable row level security;

drop policy if exists customer_addresses_self on public.customer_addresses;
drop policy if exists outlets_owner_ops on public.vendor_outlets;
drop policy if exists outlets_customer_read on public.vendor_outlets;
drop policy if exists carts_customer_self on public.commerce_carts;
drop policy if exists cart_items_customer_self on public.commerce_cart_items;
drop policy if exists tracking_parties_read on public.delivery_tracking_events;
drop policy if exists tracking_vendor_write on public.delivery_tracking_events;
drop policy if exists tracking_ops_write on public.delivery_tracking_events;
drop policy if exists tickets_scoped_read on public.support_tickets;
drop policy if exists tickets_creator_insert on public.support_tickets;
drop policy if exists tickets_ops_update on public.support_tickets;
drop policy if exists ticket_messages_scoped_read on public.support_ticket_messages;
drop policy if exists ticket_messages_scoped_insert on public.support_ticket_messages;
drop policy if exists outbox_recipient_read on public.communication_outbox;
drop policy if exists outbox_ops_manage on public.communication_outbox;

create policy customer_addresses_self on public.customer_addresses for all
using (customer_id=auth.uid() or public.current_app_role() in ('operations','admin'))
with check (customer_id=auth.uid() or public.current_app_role() in ('operations','admin'));

create policy outlets_owner_ops on public.vendor_outlets for all
using (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'))
with check (public.owns_vendor(vendor_id) or public.current_app_role() in ('operations','admin'));
create policy outlets_customer_read on public.vendor_outlets for select
using (active and open_today and exists(select 1 from public.vendors v where v.id=vendor_id and v.verification_status='verified' and v.operational_status='active' and v.marketplace_visible));

create policy carts_customer_self on public.commerce_carts for all
using (customer_id=auth.uid()) with check (customer_id=auth.uid());
create policy cart_items_customer_self on public.commerce_cart_items for all
using (exists(select 1 from public.commerce_carts c where c.id=cart_id and c.customer_id=auth.uid()))
with check (exists(select 1 from public.commerce_carts c where c.id=cart_id and c.customer_id=auth.uid()));

create policy tracking_parties_read on public.delivery_tracking_events for select
using (public.current_app_role() in ('operations','admin') or public.owns_vendor(vendor_id) or exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy tracking_vendor_write on public.delivery_tracking_events for insert
with check (public.owns_vendor(vendor_id) and recorded_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.vendor_id=vendor_id));
create policy tracking_ops_write on public.delivery_tracking_events for insert
with check (public.current_app_role() in ('operations','admin'));

create policy tickets_scoped_read on public.support_tickets for select
using (created_by=auth.uid() or public.current_app_role() in ('operations','admin') or (vendor_id is not null and public.owns_vendor(vendor_id)));
create policy tickets_creator_insert on public.support_tickets for insert
with check (created_by=auth.uid() and creator_role=public.current_app_role() and (vendor_id is null or public.owns_vendor(vendor_id)));
create policy tickets_ops_update on public.support_tickets for update
using (public.current_app_role() in ('operations','admin'));
create policy ticket_messages_scoped_read on public.support_ticket_messages for select
using (exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.created_by=auth.uid() or public.current_app_role() in ('operations','admin') or (t.vendor_id is not null and public.owns_vendor(t.vendor_id)))));
create policy ticket_messages_scoped_insert on public.support_ticket_messages for insert
with check (author_id=auth.uid() and exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.created_by=auth.uid() or public.current_app_role() in ('operations','admin') or (t.vendor_id is not null and public.owns_vendor(t.vendor_id)))));

create policy outbox_recipient_read on public.communication_outbox for select using (recipient_id=auth.uid() or public.current_app_role() in ('operations','admin'));
create policy outbox_ops_manage on public.communication_outbox for all using (public.current_app_role() in ('operations','admin')) with check (public.current_app_role() in ('operations','admin'));

insert into storage.buckets(id,name,public) values ('storefront-assets','storefront-assets',true) on conflict do nothing;
insert into storage.buckets(id,name,public) values ('ticket-attachments','ticket-attachments',false) on conflict do nothing;
drop policy if exists storefront_vendor_upload on storage.objects;
drop policy if exists storefront_public_read on storage.objects;
drop policy if exists ticket_attachment_owner on storage.objects;
create policy storefront_vendor_upload on storage.objects for insert to authenticated
with check (bucket_id='storefront-assets' and public.current_app_role()='vendor' and (storage.foldername(name))[1]=auth.uid()::text);
create policy storefront_public_read on storage.objects for select using (bucket_id='storefront-assets');
create policy ticket_attachment_owner on storage.objects for all to authenticated
using (bucket_id='ticket-attachments' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_app_role() in ('operations','admin')))
with check (bucket_id='ticket-attachments' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_app_role() in ('operations','admin')));

-- Durable verification notification. Only Operations/Admin may call it.
create or replace function public.review_vendor_and_notify(target_vendor uuid, decision text, review_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare owner uuid; verified boolean;
begin
  if public.current_app_role() not in ('operations','admin') then raise exception 'Not authorised'; end if;
  if decision not in ('verified','changes_required','rejected','under_review') then raise exception 'Invalid decision'; end if;
  verified := decision='verified';
  update public.vendors set verification_status=decision, operational_status=case when verified then 'active' else 'inactive' end,
    marketplace_visible=verified, store_open_today=case when verified then store_open_today else false end, updated_at=now()
  where id=target_vendor returning owner_id into owner;
  if owner is null then raise exception 'Vendor not found'; end if;
  insert into public.notifications(recipient_id,kind,title,body,entity_type,entity_id)
  values(owner,'vendor_verification',case when verified then 'Vendor verified' else 'Verification update' end,
    case when verified then 'Your store is approved. Open for the day and publish products.' else coalesce(review_note,'Review the Operations decision in Verification.') end,
    'vendor',target_vendor::text);
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_data)
  values(auth.uid(),public.current_app_role(),'vendor_verification','vendor',target_vendor::text,jsonb_build_object('decision',decision,'note',review_note));
end $$;
grant execute on function public.review_vendor_and_notify(uuid,text,text) to authenticated;
