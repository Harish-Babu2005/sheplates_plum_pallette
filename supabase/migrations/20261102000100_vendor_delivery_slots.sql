-- Migration: Vendor Delivery Slot Configuration
-- Table: public.vendor_delivery_slots

create table if not exists public.vendor_delivery_slots (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  slot_name text not null check (char_length(trim(slot_name)) between 1 and 80),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_delivery_slots_time_check check (end_time > start_time)
);

create index if not exists vendor_delivery_slots_vendor_idx
  on public.vendor_delivery_slots (vendor_id, is_active, start_time);

create unique index if not exists vendor_delivery_slots_vendor_name_uniq
  on public.vendor_delivery_slots (vendor_id, lower(trim(slot_name)));

alter table public.vendor_delivery_slots enable row level security;
revoke all on table public.vendor_delivery_slots from public, anon, authenticated;

grant select, insert, update, delete on public.vendor_delivery_slots to authenticated;
grant select on public.vendor_delivery_slots to anon;

-- RLS: Read active slots for customers/anon, or any slot if vendor owner or operations/admin
drop policy if exists vendor_delivery_slots_select on public.vendor_delivery_slots;
create policy vendor_delivery_slots_select
  on public.vendor_delivery_slots for select
  using (
    is_active = true
    or exists (select 1 from public.vendors v where v.id = vendor_delivery_slots.vendor_id and v.owner_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('operations', 'admin')
  );

-- RLS: Insert only if authorized vendor owner or operations/admin
drop policy if exists vendor_delivery_slots_insert on public.vendor_delivery_slots;
create policy vendor_delivery_slots_insert
  on public.vendor_delivery_slots for insert
  with check (
    exists (select 1 from public.vendors v where v.id = vendor_delivery_slots.vendor_id and v.owner_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('operations', 'admin')
  );

-- RLS: Update only if authorized vendor owner or operations/admin
drop policy if exists vendor_delivery_slots_update on public.vendor_delivery_slots;
create policy vendor_delivery_slots_update
  on public.vendor_delivery_slots for update
  using (
    exists (select 1 from public.vendors v where v.id = vendor_delivery_slots.vendor_id and v.owner_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('operations', 'admin')
  );

-- RLS: Delete only if authorized vendor owner or operations/admin
drop policy if exists vendor_delivery_slots_delete on public.vendor_delivery_slots;
create policy vendor_delivery_slots_delete
  on public.vendor_delivery_slots for delete
  using (
    exists (select 1 from public.vendors v where v.id = vendor_delivery_slots.vendor_id and v.owner_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('operations', 'admin')
  );

