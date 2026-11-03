-- Return Food Short engagement totals to the owning vendor without exposing
-- customer IDs or granting vendors read access to individual like rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_food_shorts()
RETURNS TABLE (
  id uuid,
  vendor_id uuid,
  vendor_name text,
  vendor_category text,
  product_id uuid,
  shop_link text,
  title text,
  caption text,
  video_url text,
  thumb_url text,
  duration_s numeric,
  reach_km numeric,
  status text,
  view_count integer,
  like_count bigint,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.vendor_id, v.name, v.category, s.product_id, s.shop_link,
    s.title, s.caption, s.video_url, s.thumb_url, s.duration_s, s.reach_km,
    s.status, s.view_count,
    (SELECT count(*) FROM public.food_short_likes l WHERE l.short_id = s.id),
    s.created_at
  FROM public.food_shorts s
  JOIN public.vendors v ON v.id = s.vendor_id
  WHERE auth.uid() IS NOT NULL
    AND public.current_app_role() = 'vendor'
    AND v.owner_id = auth.uid()
    AND s.status <> 'removed'
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.vendor_food_shorts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vendor_food_shorts() TO authenticated;

COMMIT;
