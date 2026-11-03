-- Connect is an independent vendor capability, not a subscription plan.
-- Existing vendors default to disabled; activation must be an explicit later action.
BEGIN;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS connect_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendors.connect_enabled IS
  'Explicit opt-in to Connect discovery and direct WhatsApp contact; independent of vendor plan.';

CREATE OR REPLACE FUNCTION public.connect_vendors_nearby(
  customer_lat double precision,
  customer_lng double precision
)
RETURNS TABLE (
  vendor_id uuid,
  vendor_name text,
  category text,
  description text,
  locality text,
  address text,
  latitude double precision,
  longitude double precision,
  whatsapp_number text,
  operating_hours jsonb,
  logo_url text,
  distance_km double precision,
  service_radius_km numeric,
  store_open_today boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    v.id AS vendor_id,
    v.name AS vendor_name,
    v.category,
    v.description,
    v.locality,
    v.address,
    v.latitude::double precision,
    v.longitude::double precision,
    v.whatsapp_number,
    v.operating_hours,
    v.logo_url,
    distance.distance_km,
    v.service_radius_km,
    v.store_open_today
  FROM public.vendors AS v
  CROSS JOIN LATERAL (
    SELECT
      6371.0 * 2 * asin(
        sqrt(
          least(
            1.0,
            greatest(
              0.0,
              power(
                sin(radians(v.latitude::double precision - customer_lat) / 2),
                2
              )
              + cos(radians(customer_lat))
              * cos(radians(v.latitude::double precision))
              * power(
                sin(radians(v.longitude::double precision - customer_lng) / 2),
                2
              )
            )
          )
        )
      ) AS distance_km
  ) AS distance
  WHERE
    customer_lat BETWEEN -90 AND 90
    AND customer_lng BETWEEN -180 AND 180
    AND v.connect_enabled = true
    AND v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND v.latitude BETWEEN -90 AND 90
    AND v.longitude BETWEEN -180 AND 180
    AND v.verification_status = 'verified'
    AND v.operational_status = 'active'
    AND v.marketplace_visible = true
    AND distance.distance_km <= v.service_radius_km
  ORDER BY distance.distance_km ASC;
$function$;

REVOKE ALL
ON FUNCTION public.connect_vendors_nearby(double precision, double precision)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.connect_vendors_nearby(double precision, double precision)
TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_vendor_whatsapp_click(
  target_vendor_id uuid,
  click_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_event_id uuid;
  current_customer_id uuid;
BEGIN
  IF click_source IS NULL
     OR click_source NOT IN ('map', 'vendor_profile', 'search') THEN
    RAISE EXCEPTION 'Invalid WhatsApp click source';
  END IF;

  current_customer_id := auth.uid();
  IF current_customer_id IS NULL
     OR public.current_app_role() IS DISTINCT FROM 'customer'::public.app_role THEN
    RAISE EXCEPTION 'Only authenticated customers may record WhatsApp contact clicks';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vendors AS v
    WHERE v.id = target_vendor_id
      AND v.connect_enabled = true
      AND v.verification_status = 'verified'
      AND v.operational_status = 'active'
      AND v.marketplace_visible = true
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
      AND v.latitude BETWEEN -90 AND 90
      AND v.longitude BETWEEN -180 AND 180
  ) THEN
    RAISE EXCEPTION 'Vendor is not available for Connect contact';
  END IF;

  INSERT INTO public.vendor_whatsapp_click_events (
    vendor_id,
    customer_id,
    source
  )
  VALUES (
    target_vendor_id,
    current_customer_id,
    click_source
  )
  RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$function$;

REVOKE ALL
ON FUNCTION public.track_vendor_whatsapp_click(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.track_vendor_whatsapp_click(uuid, text)
TO authenticated;

ALTER TABLE public.vendor_whatsapp_click_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.vendor_whatsapp_click_events
FROM PUBLIC, anon, authenticated;

COMMIT;
