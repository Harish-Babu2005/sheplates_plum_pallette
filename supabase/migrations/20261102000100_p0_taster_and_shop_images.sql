BEGIN;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('p0-shop-images', 'p0-shop-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public=true, file_size_limit=10485760, allowed_mime_types=ARRAY['image/png', 'image/jpeg', 'image/webp'];

CREATE OR REPLACE FUNCTION public.p0_start_upgrade_invitation(
  p_actor uuid,
  p_vendor uuid,
  p_plan_code text,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  vendor_row public.vendors;
  selected_plan uuid;
  invitation_id uuid;
  normalized_email text := lower(trim(p_email));
BEGIN
  IF NOT public.p0_actor_can(p_actor,'upgrade') THEN RAISE EXCEPTION 'Not authorized to upgrade P0 vendors'; END IF;
  SELECT * INTO vendor_row FROM public.vendors WHERE id=p_vendor FOR UPDATE;
  IF vendor_row.id IS NULL OR vendor_row.vendor_kind<>'p0_connect' OR vendor_row.owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unowned P0 vendor can be upgraded';
  END IF;
  IF vendor_row.p0_cancelled_at IS NOT NULL OR vendor_row.verification_status<>'verified'
     OR vendor_row.operational_status<>'active' OR NOT vendor_row.marketplace_visible THEN
    RAISE EXCEPTION 'Vendor must be approved, active and not cancelled before upgrade';
  END IF;
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid invitation email';
  END IF;
  SELECT id INTO selected_plan FROM public.vendor_plans
  WHERE code=p_plan_code AND active=true AND code IN ('taster','crave','thrive','crown');
  IF selected_plan IS NULL THEN RAISE EXCEPTION 'Select an active Taster, Crave, Thrive or Crown plan'; END IF;

  UPDATE public.p0_upgrade_invitations
  SET status='expired',updated_at=now()
  WHERE vendor_id=p_vendor AND status IN ('pending','sent','claim_pending','delivery_failed') AND expires_at<=now();

  SELECT id INTO invitation_id FROM public.p0_upgrade_invitations
  WHERE vendor_id=p_vendor AND status IN ('pending','sent','claim_pending','delivery_failed') AND expires_at>now()
  FOR UPDATE;
  IF invitation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.p0_upgrade_invitations
      WHERE id=invitation_id AND invited_email=normalized_email AND plan_id=selected_plan
    ) THEN RAISE EXCEPTION 'A different upgrade invitation is already pending'; END IF;
    RETURN invitation_id;
  END IF;

  INSERT INTO public.p0_upgrade_invitations(vendor_id,invited_email,plan_id,invited_by,expires_at)
  VALUES(p_vendor,normalized_email,selected_plan,p_actor,now()+interval '7 days')
  RETURNING id INTO invitation_id;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_data)
  SELECT p_actor,profile.role,'p0_upgrade_invitation_started','vendor',p_vendor::text,
    jsonb_build_object('invitation_id',invitation_id,'plan_code',p_plan_code,'invited_email',normalized_email,'expires_at',now()+interval '7 days')
  FROM public.profiles AS profile WHERE profile.id=p_actor;
  RETURN invitation_id;
END
$function$;

COMMIT;
