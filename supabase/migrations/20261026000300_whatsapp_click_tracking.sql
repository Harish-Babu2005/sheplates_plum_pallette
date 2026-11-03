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

  -- Associate the click with the authenticated user, if available.
  current_customer_id := auth.uid();

  -- Only track clicks for vendors eligible for customer discovery.
  IF NOT EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = target_vendor_id
      AND v.verification_status = 'verified'
      AND v.operational_status = 'active'
      AND v.marketplace_visible = true
  ) THEN
    RAISE EXCEPTION 'Vendor is not available for customer contact';
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