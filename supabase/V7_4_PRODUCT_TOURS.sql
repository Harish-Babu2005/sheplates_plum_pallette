-- V7.4 — minimal persistence for the customer/vendor product tour.
-- Stores which tour keys a user has completed so the tour shows once per user
-- (not once per login) and can still be replayed on demand from Help.
-- Self-update already allowed by the existing profiles_update_self RLS policy;
-- the guard_profile_privileges trigger only clamps role/vendor_id, so it does
-- not need to change for this column.

alter table public.profiles add column if not exists tours_completed text[] not null default '{}';
