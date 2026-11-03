-- ShePlates V3 development reset.
--
-- DESTRUCTIVE: permanently deletes every ShePlates profile and all business,
-- marketplace and transaction rows that depend on profiles. It intentionally
-- preserves schema objects, RLS policies, functions, Storage buckets and the
-- vendor_plans configuration table.
--
-- Run this in Supabase SQL Editor BEFORE:
--   npm run supabase:delete-all-users -- --confirm=DELETE_ALL_SHEPLATES_DATA
--
-- Review the selected Supabase project before running this file.

begin;

truncate table public.profiles restart identity cascade;

commit;

-- Expected result: 0 profiles and 0 tenant/business rows. Vendor plans remain.
select
  (select count(*) from public.profiles) as profiles_remaining,
  (select count(*) from public.vendors) as vendors_remaining,
  (select count(*) from public.vendor_menu_items) as products_remaining,
  (select count(*) from public.orders) as orders_remaining;
