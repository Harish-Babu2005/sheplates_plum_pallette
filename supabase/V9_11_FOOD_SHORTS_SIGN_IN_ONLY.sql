-- V9_5 and V9_6 recreated the Food Shorts functions and only removed access from "public". On Supabase the
-- signed-out role keeps its own grant, so signed-out visitors could still call them (they got an empty list).
-- This closes that: only signed-in users can call them. Safe to run more than once.
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, integer) from public, anon;
revoke all on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) from public, anon;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, integer) to authenticated;
grant execute on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) to authenticated;
