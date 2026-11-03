-- ShePlates V5 production-hardening migration.
-- Run after schema.sql, V3_UPGRADE.sql, V4_UPGRADE.sql, V4_6_AGENTIC_COMMERCE.sql and V4_8_ROLE_AGENT_SECURITY.sql.
-- Safe to re-run.

-- Product image storage used by the server-side upload route.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=10485760, allowed_mime_types=array['image/png','image/jpeg','image/webp'];

-- Each physical outlet/POS can carry its own certification metadata.
alter table public.vendor_outlets add column if not exists certificate_number text;
alter table public.vendor_outlets add column if not exists certificate_storage_path text;
alter table public.vendor_outlets add column if not exists certificate_expiry date;

-- Useful indexes for delivery planning and daily accounting exports.
create index if not exists orders_scheduled_date_vendor_idx on public.orders(scheduled_date,vendor_id,status);
create index if not exists orders_schedule_date_idx on public.orders(schedule_id,scheduled_date);
create index if not exists payments_order_status_idx on public.payments(order_id,status);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id,created_at desc) where read_at is null;
create index if not exists outbox_queued_due_idx on public.communication_outbox(status,scheduled_for) where status='queued';

-- Vendors must not be able to read a customer's unpaid checkout directly.
-- Customers and Operations/Admin can still see pending checkout rows.
drop policy if exists orders_party_read on public.orders;
create policy orders_party_read on public.orders for select using (
  customer_id=auth.uid()
  or public.current_app_role() in ('operations','admin')
  or (
    public.owns_vendor(vendor_id)
    and exists (
      select 1 from public.payments p
      where p.order_id=orders.id and lower(p.status) in ('paid','captured','success')
    )
  )
);

-- Keep direct order/payment creation server-side. No customer INSERT policy is added.
-- Delivery-team tables already exist from V3 and retain their role-scoped RLS policies.

-- Outlet certificate metadata follows the same ownership rules as the outlet itself.
-- Existing V4 policies already scope vendor_outlets by vendor ownership / Operations/Admin.

-- Optional helper for accounting exports and reporting.
create or replace view public.daily_paid_order_export as
select
  o.id,
  o.order_number,
  o.scheduled_date,
  o.scheduled_slot,
  o.customer_id,
  o.vendor_id,
  o.customer_total,
  o.fulfilment_mode,
  o.status,
  oi.product_name,
  oi.quantity,
  oi.unit,
  oi.customer_price,
  p.status as payment_status,
  p.provider_reference
from public.orders o
join public.order_items oi on oi.order_id=o.id
join lateral (
  select p1.status,p1.provider_reference
  from public.payments p1
  where p1.order_id=o.id
  order by p1.created_at desc
  limit 1
) p on true
where lower(p.status) in ('paid','captured','success');

revoke all on public.daily_paid_order_export from anon, authenticated;
grant select on public.daily_paid_order_export to service_role;
