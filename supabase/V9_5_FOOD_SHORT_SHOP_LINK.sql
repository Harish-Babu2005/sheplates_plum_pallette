-- Add an optional customer-facing shop link to Food Shorts.
alter table public.food_shorts
  add column if not exists shop_link text
  check (shop_link is null or (char_length(shop_link) <= 2048 and shop_link ~* '^https?://'));

-- The customer feed returns the link only for shorts already visible to that customer.
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
  select d.id, d.vendor_id, d.vendor_name, d.vendor_category, d.product_id, d.shop_link,
    d.title, d.caption, d.video_url, d.thumb_url, d.duration_s, d.reach_km, d.view_count,
    (select count(*) from public.food_short_likes l where l.short_id = d.id),
    exists (select 1 from public.food_short_likes l where l.short_id = d.id and l.user_id = auth.uid()),
    d.created_at, d.dist
  from d
  where auth.uid() is not null and d.dist <= least(d.reach_km::double precision, p_radius_km::double precision)
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, integer) from public;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, integer) to authenticated;

drop function if exists public.create_food_short(text, text, text, text, numeric, numeric, uuid);
create function public.create_food_short(
  p_title text, p_caption text, p_video_url text, p_thumb_url text,
  p_duration_s numeric, p_reach_km numeric, p_product_id uuid default null, p_shop_link text default null
) returns public.food_shorts
language plpgsql security definer set search_path = public as $$
declare
  v public.vendors;
  created public.food_shorts;
  reach numeric;
  shop_link_value text;
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
  shop_link_value := nullif(trim(p_shop_link), '');
  if shop_link_value is not null and (char_length(shop_link_value) > 2048 or shop_link_value !~* '^https?://') then
    raise exception 'Shop links must be valid http:// or https:// URLs';
  end if;
  reach := least(30, greatest(1, coalesce(p_reach_km, v.service_radius_km, 5)));
  insert into public.food_shorts(vendor_id, product_id, shop_link, title, caption, video_url, thumb_url, duration_s, reach_km)
  values (v.id, p_product_id, shop_link_value, left(trim(p_title), 80), left(coalesce(p_caption, ''), 300), p_video_url, p_thumb_url, p_duration_s, reach)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) from public;
grant execute on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) to authenticated;
