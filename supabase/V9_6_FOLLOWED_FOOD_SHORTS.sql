-- Customers can see active shorts from followed vendors even without a saved
-- delivery pin or when they are outside the vendor's nearby reach.
alter table public.food_shorts
  add column if not exists shop_link text
  check (shop_link is null or (char_length(shop_link) <= 2048 and shop_link ~* '^https?://'));

drop function if exists public.nearby_food_shorts(double precision, double precision, numeric, integer);
create function public.nearby_food_shorts(
  p_lat double precision, p_lng double precision, p_radius_km numeric default 30, p_limit int default 60
) returns table (
  id uuid, vendor_id uuid, vendor_name text, vendor_category text, product_id uuid, shop_link text,
  title text, caption text, video_url text, thumb_url text, duration_s numeric, reach_km numeric,
  view_count int, like_count bigint, liked boolean, created_at timestamptz, distance_km double precision
)
language sql stable security definer set search_path = public as $$
  with d as (
    select s.*, v.name as vendor_name, v.category as vendor_category,
      case
        when p_lat is not null and p_lng is not null and v.latitude is not null and v.longitude is not null
        then 6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(v.latitude::double precision - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(v.latitude::double precision))
          * power(sin(radians(v.longitude::double precision - p_lng) / 2), 2)
        )))
        else null
      end as dist
    from public.food_shorts s
    join public.vendors v on v.id = s.vendor_id
    where s.status = 'active'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible
  )
  select d.id, d.vendor_id, d.vendor_name, d.vendor_category, d.product_id, d.shop_link,
    d.title, d.caption, d.video_url, d.thumb_url, d.duration_s, d.reach_km, d.view_count,
    (select count(*) from public.food_short_likes l where l.short_id = d.id),
    exists (select 1 from public.food_short_likes l where l.short_id = d.id and l.user_id = auth.uid()),
    d.created_at, d.dist
  from d
  where auth.uid() is not null and (
    (d.dist is not null and d.dist <= least(d.reach_km::double precision, p_radius_km::double precision))
    or exists (
      select 1 from public.vendor_follows f
      where f.follower_id = auth.uid() and f.vendor_id = d.vendor_id
    )
  )
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, integer) from public;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, integer) to authenticated;
