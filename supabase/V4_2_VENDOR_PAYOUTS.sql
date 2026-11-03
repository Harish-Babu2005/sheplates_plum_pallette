-- ShePlates V4.2 — durable storage for the Vendor payments / Settlements ledger
-- introduced in the app's "Pay now" flow and the Operations/Super Admin
-- "Vendor payments" screens. Run after schema.sql + V3_UPGRADE.sql + V4_UPGRADE.sql.
--
-- The shipped app keeps this ledger in browser local state (see `transactions` in
-- components/sheplates-v3.tsx) so the full payment → payout flow is testable without
-- any external service. This migration is the forward path for teams wiring that
-- ledger to Supabase for real, multi-device, durable storage — it is not required
-- for local/demo use.

create type public.payout_status as enum ('scheduled', 'paid', 'reversed');

create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  vendor_id uuid not null references public.vendors(id),
  payment_id uuid references public.payments(id),
  customer_id uuid not null references public.profiles(id),
  method text not null default 'upi',
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_percent numeric(5,2) not null default 8,
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  vendor_payout_amount numeric(12,2) not null check (vendor_payout_amount >= 0),
  collected_at timestamptz not null default now(),
  scheduled_payout_date date not null,
  payout_status public.payout_status not null default 'scheduled',
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_payouts_vendor_idx on public.vendor_payouts(vendor_id, payout_status);
create index if not exists vendor_payouts_order_idx on public.vendor_payouts(order_id);

alter table public.vendor_payouts enable row level security;

-- Vendors read only their own payouts.
create policy vendor_payouts_select_own_vendor on public.vendor_payouts
  for select using (
    vendor_id in (select vendor_id from public.profiles where id = auth.uid())
  );

-- Customers may read the payout row tied to their own order (so "Pay now" can show its own receipt).
create policy vendor_payouts_select_own_customer on public.vendor_payouts
  for select using (customer_id = auth.uid());

-- Operations and Super Admin see and manage every payout.
create policy vendor_payouts_all_staff on public.vendor_payouts
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('operations', 'admin'))
  );

comment on table public.vendor_payouts is
  'Durable version of the in-app Vendor payments / Settlements ledger. One row per order payment collected from a customer, tracking the platform commission, the vendor''s net payout and when it is scheduled/paid. Populate from the payment-capture webhook, not directly from client code.';
