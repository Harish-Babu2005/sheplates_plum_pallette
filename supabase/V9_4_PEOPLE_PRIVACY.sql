-- V9_4 People privacy hardening. Run after V9_3_PEOPLE_STATUS.sql. Safe to re-run.
-- social_profiles is readable by every signed-in user (handles are public), which also exposed the coarse map
-- position of everyone who is on the map, with no distance limit. From now on:
--   * map_lat, map_lng and discoverable cannot be read directly; people_nearby() / status_feed() (with the
--     radius cap) are the only way to see where someone is, and my_discoverable() tells you your own setting.
--   * they cannot be written directly either: set_discoverable() is the only way, and it snaps the position
--     to the ~550 m grid.
create or replace function public.my_discoverable() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select discoverable from public.social_profiles where user_id = auth.uid()), false)
$$;
revoke all on function public.my_discoverable() from public, anon;
grant execute on function public.my_discoverable() to authenticated;

revoke select, insert, update on public.social_profiles from anon, authenticated;
grant select (user_id, handle, bio, created_at, updated_at) on public.social_profiles to anon, authenticated;
grant insert (user_id, handle, bio) on public.social_profiles to authenticated;
grant update (handle, bio, updated_at) on public.social_profiles to authenticated;
