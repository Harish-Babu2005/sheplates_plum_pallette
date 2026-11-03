-- V8.4 — Food Shorts.
--
-- A vendor posts a short vertical video (30 seconds at most). Customers see it
-- only when they are inside the distance rules, and the database enforces that:
--
--   a short is visible to a customer when
--       distance(vendor pin, customer pin)  <=  least(short.reach_km, customer's chosen radius)
--
--   reach_km is set by the vendor (1 to 30 km, default = the store's own service
--   radius). The customer's radius comes from the distance chips in the app (up to 30).
--   Customers never read the table directly: they call nearby_food_shorts(), which
--   applies the rule and the vendor-must-be-live checks on the server.
--
-- Tables
--   food_shorts        one row per video (owner vendor, ops and admin can manage)
--   food_short_likes   one row per (short, user)
-- Functions
--   nearby_food_shorts(lat, lng, radius_km, limit)   the only customer read path
--   create_food_short(...)                           vendor-only insert, enforces 30 s and a daily cap
--   record_short_view(short_id)                      increments the view counter
-- Storage
--   bucket food-shorts (public read, 30 MB, mp4/mov/webm + jpeg thumbnails),
--   a vendor writes only inside their own uid folder.
--
-- Reuses public.vendors, public.vendor_menu_items, public.profiles and the
-- existing public.current_app_role() helper. Additive only; safe to re-run.

create table if not exists public.food_shorts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid references public.vendor_menu_items(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  caption text not null default '' check (char_length(caption) <= 300),
  video_url text not null,
  thumb_url text,
  duration_s numeric(5,2) not null check (duration_s > 0 and duration_s <= 30),
  reach_km numeric(5,2) not null check (reach_km >= 1 and reach_km <= 30),
  status text not null default 'active' check (status in ('active', 'hidden', 'removed')),
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists food_shorts_vendor_idx on public.food_shorts(vendor_id, created_at desc);
create index if not exists food_shorts_status_idx on public.food_shorts(status, created_at desc);

create table if not exists public.food_short_likes (
  short_id uuid not null references public.food_shorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (short_id, user_id)
);

alter table public.food_shorts enable row level security;
alter table public.food_short_likes enable row level security;

-- Only the owning vendor and ops/admin read or write the table directly.
-- Customers go through nearby_food_shorts(), which applies the distance rule.
drop policy if exists food_shorts_owner_all on public.food_shorts;
create policy food_shorts_owner_all on public.food_shorts for all
  using (
    public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  )
  with check (
    public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  );

drop policy if exists food_short_likes_own on public.food_short_likes;
create policy food_short_likes_own on public.food_short_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The customer read path. Distance is the great-circle distance between the
-- vendor's store pin and the point the customer sends. A short is returned only
-- when that distance is within BOTH the vendor's reach and the radius asked for.
create or replace function public.nearby_food_shorts(
  p_lat double precision, p_lng double precision, p_radius_km numeric default 30, p_limit int default 60
) returns table (
  id uuid, vendor_id uuid, vendor_name text, vendor_category text, product_id uuid,
  title text, caption text, video_url text, thumb_url text, duration_s numeric, reach_km numeric,
  view_count int, like_count bigint, liked boolean, created_at timestamptz, distance_km double precision
)
language sql stable security definer set search_path = public as $$
  with d as (
    select s.*, v.name as vendor_name, v.category as vendor_category,
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians(v.latitude::double precision - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.latitude::double precision))
        * power(sin(radians(v.longitude::double precision - p_lng) / 2), 2)
      ))) as dist
    from public.food_shorts s
    join public.vendors v on v.id = s.vendor_id
    where s.status = 'active'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible
      and v.latitude is not null and v.longitude is not null
  )
  select d.id, d.vendor_id, d.vendor_name, d.vendor_category, d.product_id,
    d.title, d.caption, d.video_url, d.thumb_url, d.duration_s, d.reach_km, d.view_count,
    (select count(*) from public.food_short_likes l where l.short_id = d.id),
    exists (select 1 from public.food_short_likes l where l.short_id = d.id and l.user_id = auth.uid()),
    d.created_at, d.dist
  from d
  where auth.uid() is not null and d.dist <= least(d.reach_km::double precision, p_radius_km::double precision)
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, int) from public;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, int) to authenticated;

-- Vendor-only insert. The 30-second cap is also a table check, so it cannot be
-- bypassed by calling the table directly.
create or replace function public.create_food_short(
  p_title text, p_caption text, p_video_url text, p_thumb_url text,
  p_duration_s numeric, p_reach_km numeric, p_product_id uuid default null
) returns public.food_shorts
language plpgsql security definer set search_path = public as $$
declare
  v public.vendors;
  created public.food_shorts;
  reach numeric;
begin
  select * into v from public.vendors where owner_id = auth.uid() order by created_at limit 1;
  if v.id is null then raise exception 'Only a vendor can post a Food Short'; end if;
  if p_duration_s is null or p_duration_s <= 0 or p_duration_s > 30 then raise exception 'A Food Short can be at most 30 seconds'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Give the short a title'; end if;
  if p_video_url is null or p_video_url !~ '^https?://' then raise exception 'The video upload is missing'; end if;
  if (select count(*) from public.food_shorts where vendor_id = v.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily limit reached: 10 Food Shorts per day';
  end if;
  if p_product_id is not null and not exists (select 1 from public.vendor_menu_items where id = p_product_id and vendor_id = v.id) then
    raise exception 'That product does not belong to your store';
  end if;
  reach := least(30, greatest(1, coalesce(p_reach_km, v.service_radius_km, 5)));
  insert into public.food_shorts(vendor_id, product_id, title, caption, video_url, thumb_url, duration_s, reach_km)
  values (v.id, p_product_id, left(trim(p_title), 80), left(coalesce(p_caption, ''), 300), p_video_url, p_thumb_url, p_duration_s, reach)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.create_food_short(text, text, text, text, numeric, numeric, uuid) from public;
grant execute on function public.create_food_short(text, text, text, text, numeric, numeric, uuid) to authenticated;

create or replace function public.record_short_view(p_short_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.food_shorts set view_count = view_count + 1 where id = p_short_id and status = 'active' and auth.uid() is not null;
$$;
revoke all on function public.record_short_view(uuid) from public;
grant execute on function public.record_short_view(uuid) to authenticated;

-- Storage: public read so the video plays in the feed, writes only by a vendor
-- inside their own uid folder, 30 MB cap, video and thumbnail types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-shorts', 'food-shorts', true, 31457280, array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists food_shorts_media_read on storage.objects;
create policy food_shorts_media_read on storage.objects for select using (bucket_id = 'food-shorts');
drop policy if exists food_shorts_media_insert on storage.objects;
create policy food_shorts_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'food-shorts' and (storage.foldername(name))[1] = auth.uid()::text and public.current_app_role() = 'vendor');
drop policy if exists food_shorts_media_delete on storage.objects;
create policy food_shorts_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'food-shorts' and ((storage.foldername(name))[1] = auth.uid()::text or public.current_app_role() in ('operations', 'admin')));
