-- ShePlates V3.3: cross-login marketplace visibility and server-side radius matching.
-- Run once in Supabase SQL Editor after schema.sql and V3_UPGRADE.sql.

alter table public.vendor_menu_items add column if not exists pack_amount numeric(12,3);
alter table public.vendor_menu_items add column if not exists pack_measure text;

drop function if exists public.marketplace_menu_nearby(double precision,double precision);
create function public.marketplace_menu_nearby(customer_lat double precision, customer_lng double precision)
returns table(
  item_id uuid, vendor_id uuid, vendor_name text, item_name text, category text,
  unit text, quantity_step numeric, stock_quantity numeric, image_url text,
  customer_price numeric, calories_per_unit numeric, protein_g numeric, carbs_g numeric,
  fat_g numeric, fibre_g numeric, dietary_tags text[], pack_amount numeric, pack_measure text,
  delivery_enabled boolean, pickup_enabled boolean, distance_km numeric
)
language sql stable security definer set search_path=public as $$
  with eligible as (
    select
      item.id as item_id, vendor.id as vendor_id, vendor.name as vendor_name,
      item.name as item_name, item.category, item.unit, item.quantity_step,
      item.stock_quantity, item.image_url,
      round(item.vendor_base_price*(1+coalesce(markup.markup_percent,0)/100),2) as customer_price,
      item.calories_per_unit, item.protein_g, item.carbs_g, item.fat_g, item.fibre_g,
      item.dietary_tags, item.pack_amount, item.pack_measure,
      vendor.delivery_enabled, vendor.pickup_enabled, vendor.service_radius_km,
      6371 * 2 * asin(sqrt(
        power(sin(radians((vendor.latitude::double precision-customer_lat)/2)),2) +
        cos(radians(customer_lat))*cos(radians(vendor.latitude::double precision))*
        power(sin(radians((vendor.longitude::double precision-customer_lng)/2)),2)
      )) as calculated_distance_km
    from public.vendor_menu_items item
    join public.vendors vendor on vendor.id=item.vendor_id
    left join public.vendor_item_markups markup on markup.menu_item_id=item.id
    where customer_lat between -90 and 90 and customer_lng between -180 and 180
      and vendor.latitude is not null and vendor.longitude is not null
      and item.active and item.stock_quantity > 0
      and vendor.verification_status='verified'
      and vendor.operational_status='active'
      and vendor.marketplace_visible
      and vendor.store_open_today
      and (vendor.delivery_enabled or vendor.pickup_enabled)
  )
  select
    item_id,vendor_id,vendor_name,item_name,category,unit,quantity_step,stock_quantity,image_url,
    customer_price,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,
    pack_amount,pack_measure,delivery_enabled,pickup_enabled,
    round(calculated_distance_km::numeric,2) as distance_km
  from eligible
  where calculated_distance_km <= service_radius_km
  order by calculated_distance_km,item_name;
$$;
grant execute on function public.marketplace_menu_nearby(double precision,double precision) to authenticated;

drop function if exists public.marketplace_visibility_diagnostics(double precision,double precision);
create function public.marketplace_visibility_diagnostics(customer_lat double precision, customer_lng double precision)
returns table(
  verified_vendors bigint, open_vendors bigint, vendors_with_products bigint,
  vendors_in_radius bigint, serviceable_products bigint
)
language sql stable security definer set search_path=public as $$
  with vendor_distance as (
    select vendor.id, vendor.store_open_today, vendor.operational_status, vendor.marketplace_visible,
      vendor.service_radius_km,
      case when vendor.latitude is null or vendor.longitude is null then null else
        6371 * 2 * asin(sqrt(
          power(sin(radians((vendor.latitude::double precision-customer_lat)/2)),2) +
          cos(radians(customer_lat))*cos(radians(vendor.latitude::double precision))*
          power(sin(radians((vendor.longitude::double precision-customer_lng)/2)),2)
        )) end as distance_km
    from public.vendors vendor
    where vendor.verification_status='verified'
  ), product_counts as (
    select vendor_id,count(*) filter (where active and stock_quantity > 0) as products
    from public.vendor_menu_items group by vendor_id
  )
  select
    count(*)::bigint,
    count(*) filter (where vd.store_open_today and vd.operational_status='active' and vd.marketplace_visible)::bigint,
    count(*) filter (where coalesce(pc.products,0)>0)::bigint,
    count(*) filter (where vd.distance_km is not null and vd.distance_km<=vd.service_radius_km)::bigint,
    coalesce(sum(pc.products) filter (
      where vd.store_open_today and vd.operational_status='active' and vd.marketplace_visible
        and vd.distance_km is not null and vd.distance_km<=vd.service_radius_km
    ),0)::bigint
  from vendor_distance vd left join product_counts pc on pc.vendor_id=vd.id;
$$;
grant execute on function public.marketplace_visibility_diagnostics(double precision,double precision) to authenticated;

-- Keep customer visibility in sync with an Operations verification decision.
update public.vendors
set marketplace_visible=true
where verification_status='verified' and operational_status='active';
