BEGIN;

-- Add Connect fields to existing vendors.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb;

COMMENT ON COLUMN public.vendors.whatsapp_number IS
  'Vendor WhatsApp contact in international format, without URL encoding.';

COMMENT ON COLUMN public.vendors.operating_hours IS
  'Structured weekly business hours; format will be validated by the application.';

-- Store WhatsApp contact-button click events.
CREATE TABLE IF NOT EXISTS public.vendor_whatsapp_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL
    REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL
    CHECK (source IN ('map', 'vendor_profile', 'search')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Support analytics queries by vendor and date.
CREATE INDEX IF NOT EXISTS
  idx_vendor_whatsapp_click_events_vendor_created
ON public.vendor_whatsapp_click_events (
  vendor_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_vendor_whatsapp_click_events_source_created
ON public.vendor_whatsapp_click_events (
  source,
  created_at DESC
);

-- Block direct client access to analytics records.
ALTER TABLE public.vendor_whatsapp_click_events
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.vendor_whatsapp_click_events
FROM PUBLIC, anon, authenticated;

COMMIT;