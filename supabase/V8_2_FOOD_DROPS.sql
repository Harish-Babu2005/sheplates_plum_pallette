-- V8.2 — Food Drops.
--
-- Vendor-created, time-limited offers on an existing product. The one part
-- of this feature that cannot be a client-side/local-first mock is the
-- inventory guard: two customers racing for the last unit of a drop must
-- never both succeed. That guard lives entirely in Postgres, not the app
-- server or the browser — see claim_food_drop() below.
--
--   food_drops       one row per offer: which product, at what price, how
--                    many units, and the claim window. remaining_quantity
--                    is only ever changed by claim_food_drop()'s single
--                    conditional UPDATE.
--   food_drop_claims append-only log of successful claims — the "order"
--                    for a drop. Kept separate from public.orders because
--                    that table's RFQ/quote-oriented shape (order_number
--                    generation, scheduled_date strictly in the future,
--                    a whole checkout/payment pipeline) doesn't fit a
--                    "claim now" flash offer; a drop claim is settled
--                    directly with the vendor at pickup/delivery, same as
--                    how vendors already handle their own store fulfilment.
--
-- Reuses public.vendors / public.vendor_menu_items / public.profiles and the
-- existing public.current_app_role() RLS helper. Additive only.

create table if not exists public.food_drops (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.vendor_menu_items(id) on delete cascade,
  title text not null,
  description text,
  drop_price numeric(12,2) not null check (drop_price >= 0),
  original_price numeric(12,2) not null check (original_price >= 0),
  total_quantity int not null check (total_quantity > 0),
  remaining_quantity int not null check (remaining_quantity >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_drops_window check (ends_at > starts_at),
  constraint food_drops_remaining_within_total check (remaining_quantity <= total_quantity)
);
create index if not exists food_drops_vendor_idx on public.food_drops(vendor_id, created_at desc);
create index if not exists food_drops_active_idx on public.food_drops(ends_at) where status = 'active';

create table if not exists public.food_drop_claims (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.food_drops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  claimed_at timestamptz not null default now()
);
create index if not exists food_drop_claims_drop_idx on public.food_drop_claims(drop_id);
create index if not exists food_drop_claims_customer_idx on public.food_drop_claims(customer_id, claimed_at desc);

alter table public.food_drops enable row level security;
alter table public.food_drop_claims enable row level security;

-- Drops are marketing content — visible to anyone, same as a product.
-- Only the owning vendor (or ops/admin) can create/edit/cancel one.
create policy food_drops_read on public.food_drops for select
  using (true);
create policy food_drops_vendor_write on public.food_drops for all
  using (
    public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  )
  with check (
    public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  );

-- A claim is visible to the customer who made it, the vendor who owns the
-- drop (for their analytics), and ops/admin. Nobody inserts a claim row
-- directly — only claim_food_drop() does, after the atomic stock check.
create policy food_drop_claims_read on public.food_drop_claims for select
  using (
    customer_id = auth.uid()
    or public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.food_drops d join public.vendors v on v.id = d.vendor_id where d.id = drop_id and v.owner_id = auth.uid())
  );

-- The overselling guard. A single UPDATE ... WHERE remaining_quantity >= p_quantity
-- is atomic in Postgres: under concurrent claims for the last units, exactly
-- as many succeed as there is real stock for, and every loser gets a clean
-- "sold out" error instead of a negative-inventory race. SECURITY DEFINER so
-- an authenticated customer (who has no UPDATE grant on food_drops) can still
-- call it; auth.uid() is read straight from the JWT, not a client-supplied
-- argument, so a claim can never be filed under someone else's name.
create or replace function public.claim_food_drop(p_drop_id uuid, p_quantity int)
returns public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  update public.food_drops
    set remaining_quantity = remaining_quantity - p_quantity, updated_at = now()
    where id = p_drop_id
      and status = 'active'
      and now() between starts_at and ends_at
      and remaining_quantity >= p_quantity
    returning * into v_drop;

  if v_drop.id is null then
    raise exception 'This drop is sold out, has ended, or is no longer available' using errcode = 'P0001';
  end if;

  insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
  values (p_drop_id, auth.uid(), p_quantity, v_drop.drop_price, v_drop.drop_price * p_quantity)
  returning * into v_claim;

  return v_claim;
end;
$$;

grant execute on function public.claim_food_drop(uuid, int) to authenticated;
