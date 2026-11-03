-- V8.1 — Taste Match Engine.
--
-- Adds the three tables the personalization layer needs:
--   taste_profiles       one row per customer, a weighted preference vector
--                        (dimension -> 0..1) stored as jsonb rather than a
--                        row-per-dimension design, since the dimension set
--                        (Spicy, Chicken, South Indian, ...) is small,
--                        largely fixed, and always read/written as a whole.
--   food_item_attributes one row per product, the same kind of weighted
--                        vector describing the dish itself. Populated by AI
--                        inference (cached here so a product is only ever
--                        classified once) or set directly by a vendor.
--   taste_feedback       an append-only signal log (view/save/order/
--                        more_like_this/less_like_this/...) — the taste
--                        profile's weights are derived from this log client
--                        side (see lib/taste-match.ts) rather than computed
--                        in the database, so the scoring model stays easy to
--                        read, test and explain ("why this matches").
--
-- Reuses public.profiles / public.vendors / public.vendor_menu_items and the
-- existing public.current_app_role() RLS helper — no new user/vendor/product
-- tables. Additive only.

create table if not exists public.taste_profiles (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_item_attributes (
  product_id uuid primary key references public.vendor_menu_items(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  source text not null default 'inferred' check (source in ('inferred','vendor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.taste_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.vendor_menu_items(id) on delete set null,
  signal text not null check (signal in ('view','save','like','order','repeat_order','follow_vendor','more_like_this','less_like_this','skip')),
  created_at timestamptz not null default now()
);
create index if not exists taste_feedback_customer_idx on public.taste_feedback(customer_id, created_at desc);
create index if not exists food_item_attributes_updated_idx on public.food_item_attributes(updated_at);

alter table public.taste_profiles enable row level security;
alter table public.food_item_attributes enable row level security;
alter table public.taste_feedback enable row level security;

-- A customer manages only their own taste profile; operations/admin can read
-- any of them for support and the future analytics dashboard.
create policy taste_profiles_owner_all on public.taste_profiles for all
  using (customer_id = auth.uid() or public.current_app_role() in ('operations','admin'))
  with check (customer_id = auth.uid());

-- Attributes are read by anyone (they're just product metadata, same
-- visibility as the product itself) and written by the owning vendor, an
-- operations/admin account, or the AI-inference API route (which runs on the
-- service-role key and bypasses RLS entirely, so no policy is needed for it).
create policy food_item_attributes_read on public.food_item_attributes for select
  using (true);
create policy food_item_attributes_vendor_insert on public.food_item_attributes for insert
  with check (
    public.current_app_role() in ('operations','admin')
    or exists (select 1 from public.vendor_menu_items i join public.vendors v on v.id=i.vendor_id where i.id=product_id and v.owner_id=auth.uid())
  );
create policy food_item_attributes_vendor_update on public.food_item_attributes for update
  using (
    public.current_app_role() in ('operations','admin')
    or exists (select 1 from public.vendor_menu_items i join public.vendors v on v.id=i.vendor_id where i.id=product_id and v.owner_id=auth.uid())
  );

-- Feedback is an append-only log a customer writes for themself; nobody
-- (including the customer) can edit or delete a past signal.
create policy taste_feedback_insert on public.taste_feedback for insert
  with check (customer_id = auth.uid());
create policy taste_feedback_read on public.taste_feedback for select
  using (customer_id = auth.uid() or public.current_app_role() in ('operations','admin'));
