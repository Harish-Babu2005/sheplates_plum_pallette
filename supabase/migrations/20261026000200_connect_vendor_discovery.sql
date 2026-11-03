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
                sin(
                  radians(
                    v.latitude::double precision - customer_lat
                  ) / 2
                ),
                2
              )
              +
              cos(radians(customer_lat))
              * cos(radians(v.latitude::double precision))
              * power(
                sin(
                  radians(
                    v.longitude::double precision - customer_lng
                  ) / 2
                ),
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
    AND v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND v.verification_status = 'verified'
    AND v.operational_status = 'active'
    AND v.marketplace_visible = true
    AND distance.distance_km <= v.service_radius_km
  ORDER BY distance.distance_km ASC;
$function$;

GRANT EXECUTE
ON FUNCTION public.connect_vendors_nearby(
  double precision,
  double precision
)
TO anon, authenticated;