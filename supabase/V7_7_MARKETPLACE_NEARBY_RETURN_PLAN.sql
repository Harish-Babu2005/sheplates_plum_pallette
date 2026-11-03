-- V7.7 — return each vendor's real subscription plan from marketplace_menu_nearby,
-- and fix the client's vendor-plan wiring end to end.
--
-- Bug found during QA of the RFQ / Monthly Requirement feature: the client
-- (components/sheplates-v3.tsx) hardcodes `plan: "Launch"` on every Vendor
-- object it builds from live data — the Super Admin's "Vendor plans" page lets
-- you pick Launch/Growth/Premium in a dropdown, but that write only ever
-- touched local React state, never the database. A vendor's own dashboard
-- reloads fresh from Supabase on every sign-in and gets "Launch" again no
-- matter what Super Admin set, and a customer's RFQ eligibility check (which
-- requires `plan === "Premium"`) reads the same hardcoded value — so no
-- vendor could ever receive an RFQ in production. The database side of this
-- was already fully built (public.vendor_plans, vendors.plan_id, RLS that lets
-- only admin/operations reassign it) and simply never wired into the client.
--
-- This migration adds the vendor's plan code to marketplace_menu_nearby's
-- return columns so the customer-facing RFQ eligibility check can see it.
-- Additive and read-only: same eligibility filtering, one extra output column.

drop function if exists public.marketplace_menu_nearby(double precision,double precision);
create function public.marketplace_menu_nearby(customer_lat double precision, customer_lng double precision)
returns table(
  item_id uuid, vendor_id uuid, vendor_name text, item_name text, category text,
  unit text, quantity_step numeric, stock_quantity numeric, image_url text,
  customer_price numeric, calories_per_unit numeric, protein_g numeric, carbs_g numeric,
  fat_g numeric, fibre_g numeric, dietary_tags text[], pack_amount numeric, pack_measure text,
  delivery_enabled boolean, pickup_enabled boolean, distance_km numeric,
  vendor_lat double precision, vendor_lng double precision, vendor_plan_code text
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
      vendor.latitude::double precision as vendor_lat, vendor.longitude::double precision as vendor_lng,
      coalesce(plan.code,'launch') as vendor_plan_code,
      6371 * 2 * asin(sqrt(
        power(sin(radians((vendor.latitude::double precision-customer_lat)/2)),2) +
        cos(radians(customer_lat))*cos(radians(vendor.latitude::double precision))*
        power(sin(radians((vendor.longitude::double precision-customer_lng)/2)),2)
      )) as calculated_distance_km
    from public.vendor_menu_items item
    join public.vendors vendor on vendor.id=item.vendor_id
    left join public.vendor_item_markups markup on markup.menu_item_id=item.id
    left join public.vendor_plans plan on plan.id=vendor.plan_id
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
    round(calculated_distance_km::numeric,2) as distance_km,
    vendor_lat, vendor_lng, vendor_plan_code
  from eligible
  where calculated_distance_km <= service_radius_km
  order by calculated_distance_km,item_name;
$$;
grant execute on function public.marketplace_menu_nearby(double precision,double precision) to authenticated;
