-- ShePlates V4.6 — customer AI memory, marketplace merchandising and campaigns
-- Safe to run after the packaged V4 upgrades. Uses existing current_app_role() helper.

create table if not exists public.customer_ai_memory (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  confidence numeric(5,2) not null default 80 check (confidence >= 0 and confidence <= 100),
  source text not null default 'she_agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, memory_key)
);

create table if not exists public.platform_settings (
  setting_key text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text not null,
  offer text not null,
  channel text not null default 'in-app',
  status text not null default 'draft' check (status in ('draft','active','paused')),
  ai_rationale text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendor_menu_items add column if not exists image_url text;

insert into public.platform_settings(setting_key, config)
values ('marketplace_home', '{"featuredProductIds":[],"recommendationPopupEnabled":true,"maxFeatured":6}'::jsonb)
on conflict (setting_key) do nothing;

alter table public.customer_ai_memory enable row level security;
alter table public.platform_settings enable row level security;
alter table public.marketing_campaigns enable row level security;

drop policy if exists customer_ai_memory_self_select on public.customer_ai_memory;
drop policy if exists customer_ai_memory_self_insert on public.customer_ai_memory;
drop policy if exists customer_ai_memory_self_update on public.customer_ai_memory;
drop policy if exists customer_ai_memory_self_delete on public.customer_ai_memory;
create policy customer_ai_memory_self_select on public.customer_ai_memory for select using (customer_id = auth.uid());
create policy customer_ai_memory_self_insert on public.customer_ai_memory for insert with check (customer_id = auth.uid());
create policy customer_ai_memory_self_update on public.customer_ai_memory for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy customer_ai_memory_self_delete on public.customer_ai_memory for delete using (customer_id = auth.uid());

drop policy if exists platform_settings_authenticated_read on public.platform_settings;
drop policy if exists platform_settings_admin_write on public.platform_settings;
create policy platform_settings_authenticated_read on public.platform_settings for select using (auth.uid() is not null);
create policy platform_settings_admin_write on public.platform_settings for all using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists marketing_campaigns_team_read on public.marketing_campaigns;
drop policy if exists marketing_campaigns_admin_write on public.marketing_campaigns;
create policy marketing_campaigns_team_read on public.marketing_campaigns for select using (public.current_app_role() in ('operations','admin'));
create policy marketing_campaigns_admin_write on public.marketing_campaigns for all using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create index if not exists customer_ai_memory_updated_idx on public.customer_ai_memory(customer_id, updated_at desc);
create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns(status, created_at desc);

-- Product image storage. Customer marketplace images are public; only the owning vendor
-- (path prefix = vendor UUID) or Super Admin can upload/change assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_vendor_insert on storage.objects;
drop policy if exists product_images_vendor_update on storage.objects;
drop policy if exists product_images_vendor_delete on storage.objects;
create policy product_images_public_read on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_vendor_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images' and (
    public.current_app_role() = 'admin' or
    (public.current_app_role() = 'vendor' and (storage.foldername(name))[1] = (select vendor_id::text from public.profiles where id = auth.uid()))
  )
);
create policy product_images_vendor_update on storage.objects for update to authenticated using (
  bucket_id = 'product-images' and (
    public.current_app_role() = 'admin' or
    (public.current_app_role() = 'vendor' and (storage.foldername(name))[1] = (select vendor_id::text from public.profiles where id = auth.uid()))
  )
) with check (
  bucket_id = 'product-images' and (
    public.current_app_role() = 'admin' or
    (public.current_app_role() = 'vendor' and (storage.foldername(name))[1] = (select vendor_id::text from public.profiles where id = auth.uid()))
  )
);
create policy product_images_vendor_delete on storage.objects for delete to authenticated using (
  bucket_id = 'product-images' and (
    public.current_app_role() = 'admin' or
    (public.current_app_role() = 'vendor' and (storage.foldername(name))[1] = (select vendor_id::text from public.profiles where id = auth.uid()))
  )
);
