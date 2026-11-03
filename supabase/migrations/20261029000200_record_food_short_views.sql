-- Record a customer view and return the updated counter to the viewer.
BEGIN;

DROP FUNCTION IF EXISTS public.record_short_view(uuid);

CREATE FUNCTION public.record_short_view(p_short_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_view_count integer;
BEGIN
  IF auth.uid() IS NULL OR public.current_app_role() <> 'customer' THEN
    RAISE EXCEPTION 'Only signed-in customers can record Food Short views';
  END IF;

  UPDATE public.food_shorts
  SET view_count = view_count + 1
  WHERE id = p_short_id AND status = 'active'
  RETURNING view_count INTO updated_view_count;

  RETURN coalesce(updated_view_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.record_short_view(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_short_view(uuid) TO authenticated;

COMMIT;
