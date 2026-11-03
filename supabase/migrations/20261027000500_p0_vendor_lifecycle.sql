-- P0 Connect vendors are staff-managed directory records, not subscription accounts.
-- Apply only after reviewing the deployed schema and confirming migrations 001-004,
-- V3_UPGRADE.sql, V4_UPGRADE.sql, and V7.7_MARKETPLACE_NEARBY_RETURN_PLAN.sql
-- have been applied in the target environment.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors' AND column_name='whatsapp_number'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors' AND column_name='logo_url'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors' AND column_name='operating_hours'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors' AND column_name='address'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors' AND column_name='store_open_today'
  ) OR to_regclass('public.vendor_whatsapp_click_events') IS NULL
     OR to_regclass('public.vendor_documents') IS NULL
     OR to_regclass('public.vendor_plans') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('public.notifications') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc procedure
       WHERE procedure.pronamespace='public'::regnamespace
         AND procedure.proname='marketplace_menu_nearby'
         AND procedure.proargtypes='701 701'::oidvector
  ) THEN
    RAISE EXCEPTION 'P0 migration prerequisites are missing: verify the Connect foundation, storefront schema, and V7.7 marketplace RPC first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendors WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'P0 migration stopped: existing unowned vendor rows require a reviewed classification before applying the ownership constraint';
  END IF;
END
$preflight$;

ALTER TABLE public.vendors
  ALTER COLUMN owner_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS vendor_kind text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS connect_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS p0_created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS p0_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS p0_contact_name text,
  ADD COLUMN IF NOT EXISTS p0_contact_phone text,
  ADD COLUMN IF NOT EXISTS p0_fssai_required boolean NOT NULL DEFAULT false;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='vendors_kind_check' AND conrelid='public.vendors'::regclass) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_kind_check
      CHECK (vendor_kind IN ('subscription','p0_connect'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='vendors_kind_owner_plan_check' AND conrelid='public.vendors'::regclass) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_kind_owner_plan_check
      CHECK (
        (vendor_kind='p0_connect' AND owner_id IS NULL AND plan_id IS NULL)
        OR (vendor_kind='subscription' AND owner_id IS NOT NULL)
      );
  END IF;
END
$constraints$;

COMMENT ON COLUMN public.vendors.vendor_kind IS
  'Separates staff-managed P0 Connect listings from subscription vendors; existing rows remain subscription by default.';
COMMENT ON COLUMN public.vendors.p0_created_by IS
  'Immutable P0 creator identity used to prevent self-approval.';
COMMENT ON COLUMN public.vendors.p0_cancelled_at IS
  'P0 cancellation marker; operational_status remains the existing inactive enum value.';
COMMENT ON COLUMN public.vendors.p0_fssai_required IS
  'Operations-selected conditional certificate requirement for this P0 vendor.';

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
     AND NEW.vendor_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.vendors vendor
       WHERE vendor.id=NEW.vendor_id AND vendor.vendor_kind='p0_connect'
     ) THEN
    RAISE EXCEPTION 'P0 ownership must be established through the authorized upgrade flow';
  END IF;
  IF auth.uid() IS NOT NULL AND public.current_app_role()<>'admin' THEN
    NEW.role:=OLD.role;
    IF NOT (
      OLD.role='vendor' AND OLD.vendor_id IS NULL AND NEW.vendor_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.vendors vendor
        WHERE vendor.id=NEW.vendor_id AND vendor.vendor_kind='subscription'
          AND vendor.owner_id=auth.uid()
      )
    ) THEN
      NEW.vendor_id:=OLD.vendor_id;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TABLE IF NOT EXISTS public.p0_vendor_permissions (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_create boolean NOT NULL DEFAULT false,
  can_review boolean NOT NULL DEFAULT false,
  can_cancel boolean NOT NULL DEFAULT false,
  can_reactivate boolean NOT NULL DEFAULT false,
  can_upgrade boolean NOT NULL DEFAULT false,
  can_upload boolean NOT NULL DEFAULT false,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.p0_upgrade_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  invited_email text NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.vendor_plans(id),
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  provider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','claim_pending','delivery_failed','revoked','expired','completed')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS p0_one_live_upgrade_invitation
  ON public.p0_upgrade_invitations(vendor_id)
  WHERE status IN ('pending','sent','claim_pending','delivery_failed');

CREATE TABLE IF NOT EXISTS public.p0_vendor_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  historical_whatsapp_number text NOT NULL,
  reason text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.p0_vendor_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p0_upgrade_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p0_vendor_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.p0_vendor_permissions, public.p0_upgrade_invitations, public.p0_vendor_history
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.p0_actor_can(p_actor uuid, p_action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id=p_actor
      AND (
        profile.role='admin'
        OR (
          profile.role='operations'
          AND EXISTS (
            SELECT 1
            FROM public.p0_vendor_permissions AS permission
            WHERE permission.profile_id=profile.id
              AND CASE p_action
                WHEN 'create' THEN permission.can_create
                WHEN 'review' THEN permission.can_review
                WHEN 'cancel' THEN permission.can_cancel
                WHEN 'reactivate' THEN permission.can_reactivate
                WHEN 'upgrade' THEN permission.can_upgrade
                WHEN 'upload' THEN permission.can_upload
                ELSE false
              END
          )
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.p0_current_actor_can(p_action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
  SELECT public.p0_actor_can(auth.uid(),p_action)
$function$;

CREATE OR REPLACE FUNCTION public.p0_set_operations_permissions(
  p_actor uuid,
  p_operations_profile uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  previous_permissions jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN
    RAISE EXCEPTION 'Only Super Admin may assign P0 Operations permissions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_operations_profile AND role='operations') THEN
    RAISE EXCEPTION 'P0 permissions can only be assigned to an Operations account';
  END IF;

  SELECT to_jsonb(permission) INTO previous_permissions
  FROM public.p0_vendor_permissions AS permission
  WHERE permission.profile_id=p_operations_profile;

  INSERT INTO public.p0_vendor_permissions (
    profile_id, can_create, can_review, can_cancel, can_reactivate, can_upgrade, can_upload, assigned_by, assigned_at
  )
  VALUES (
    p_operations_profile,
    coalesce((p_permissions->>'can_create')::boolean,false),
    coalesce((p_permissions->>'can_review')::boolean,false),
    coalesce((p_permissions->>'can_cancel')::boolean,false),
    coalesce((p_permissions->>'can_reactivate')::boolean,false),
    coalesce((p_permissions->>'can_upgrade')::boolean,false),
    coalesce((p_permissions->>'can_upload')::boolean,false),
    p_actor,
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    can_create=excluded.can_create,
    can_review=excluded.can_review,
    can_cancel=excluded.can_cancel,
    can_reactivate=excluded.can_reactivate,
    can_upgrade=excluded.can_upgrade,
    can_upload=excluded.can_upload,
    assigned_by=excluded.assigned_by,
    assigned_at=excluded.assigned_at;

  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_data,after_data)
  VALUES (
    p_actor,'admin','p0_permissions_updated','profile',p_operations_profile::text,
    previous_permissions,
    (SELECT to_jsonb(permission) FROM public.p0_vendor_permissions AS permission WHERE permission.profile_id=p_operations_profile)
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.p0_create_vendor(
  p_actor uuid,
  p_name text,
  p_category text,
  p_description text,
  p_locality text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_service_radius_km numeric,
  p_contact_name text,
  p_contact_phone text,
  p_whatsapp_number text,
  p_fssai_required boolean DEFAULT false,
  p_logo_url text DEFAULT NULL,
  p_operating_hours jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  created_vendor uuid;
  duration_hours numeric;
BEGIN
  IF NOT public.p0_actor_can(p_actor,'create') THEN
    RAISE EXCEPTION 'Not authorized to create P0 vendors';
  END IF;
  IF coalesce(trim(p_name),'')='' OR coalesce(trim(p_category),'')='' OR coalesce(trim(p_locality),'')='' THEN
    RAISE EXCEPTION 'Business name, category and locality are required';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Valid vendor coordinates are required';
  END IF;
  IF p_service_radius_km IS NULL OR p_service_radius_km NOT BETWEEN 0.5 AND 100 THEN
    RAISE EXCEPTION 'Service radius must be between 0.5 and 100 km';
  END IF;
  IF coalesce(trim(p_contact_name),'')='' OR coalesce(trim(p_contact_phone),'')='' THEN
    RAISE EXCEPTION 'P0 contact name and phone are required';
  END IF;
  IF p_whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'WhatsApp number must be normalized to international format';
  END IF;
  BEGIN
    duration_hours := (p_operating_hours->>'duration_hours')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Operating duration must be between 1 and 24 hours';
  END;
  IF duration_hours IS NULL OR duration_hours NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Operating duration must be between 1 and 24 hours';
  END IF;

  INSERT INTO public.vendors(
    owner_id,plan_id,vendor_kind,p0_created_by,p0_contact_name,p0_contact_phone,p0_fssai_required,
    name,category,description,locality,address,latitude,longitude,service_radius_km,
    verification_status,operational_status,marketplace_visible,connect_enabled,whatsapp_number,logo_url,
    operating_hours,delivery_enabled,pickup_enabled,store_open_today
  )
  VALUES (
    NULL,NULL,'p0_connect',p_actor,trim(p_contact_name),trim(p_contact_phone),coalesce(p_fssai_required,false),
    trim(p_name),trim(p_category),nullif(trim(p_description),''),trim(p_locality),nullif(trim(p_address),''),
    p_latitude,p_longitude,p_service_radius_km,'submitted','inactive',false,false,p_whatsapp_number,
    nullif(trim(p_logo_url),''),jsonb_build_object('duration_hours',duration_hours),false,true,false
  )
  RETURNING id INTO created_vendor;

  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_data)
  SELECT p_actor,profile.role,'p0_vendor_created','vendor',created_vendor::text,
    jsonb_build_object('vendor_kind','p0_connect','verification_status','submitted','operational_status','inactive','marketplace_visible',false)
  FROM public.profiles AS profile WHERE profile.id=p_actor;
  RETURN created_vendor;
END
$function$;

CREATE OR REPLACE FUNCTION public.p0_cancel_vendor(p_actor uuid, p_vendor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  prior_state jsonb;
  kind text;
BEGIN
  IF NOT public.p0_actor_can(p_actor,'cancel') THEN
    RAISE EXCEPTION 'Not authorized to cancel P0 vendors';
  END IF;
  SELECT jsonb_build_object(
    'id',vendor.id,'vendor_kind',vendor.vendor_kind,'verification_status',vendor.verification_status,
    'operational_status',vendor.operational_status,'marketplace_visible',vendor.marketplace_visible,
    'p0_cancelled_at',vendor.p0_cancelled_at
  ),vendor.vendor_kind INTO prior_state,kind
  FROM public.vendors AS vendor WHERE vendor.id=p_vendor FOR UPDATE;
  IF kind IS DISTINCT FROM 'p0_connect' THEN RAISE EXCEPTION 'P0 vendor not found'; END IF;

  UPDATE public.vendors
  SET operational_status='inactive',marketplace_visible=false,p0_cancelled_at=now(),updated_at=now()
  WHERE id=p_vendor;
  UPDATE public.p0_upgrade_invitations
  SET status='revoked',updated_at=now()
  WHERE vendor_id=p_vendor AND status IN ('pending','sent','claim_pending','delivery_failed');

  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_data,after_data)
  SELECT p_actor,profile.role,'p0_vendor_cancelled','vendor',p_vendor::text,prior_state,
    jsonb_build_object('operational_status','inactive','marketplace_visible',false,'p0_cancelled_at',now())
  FROM public.profiles AS profile WHERE profile.id=p_actor;
END
$function$;

CREATE OR REPLACE FUNCTION public.p0_reactivate_vendor(p_actor uuid, p_vendor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  prior_state jsonb;
BEGIN
  IF NOT public.p0_actor_can(p_actor,'reactivate') THEN
    RAISE EXCEPTION 'Not authorized to reactivate P0 vendors';
  END IF;
  SELECT to_jsonb(vendor) INTO prior_state
  FROM public.vendors AS vendor
  WHERE vendor.id=p_vendor AND vendor.vendor_kind='p0_connect' AND vendor.p0_cancelled_at IS NOT NULL
  FOR UPDATE;
  IF prior_state IS NULL THEN RAISE EXCEPTION 'Cancelled P0 vendor not found'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendors AS vendor WHERE vendor.id=p_vendor
      AND (vendor.verification_status<>'verified' OR vendor.latitude IS NULL OR vendor.longitude IS NULL
        OR vendor.latitude NOT BETWEEN -90 AND 90 OR vendor.longitude NOT BETWEEN -180 AND 180
        OR vendor.service_radius_km NOT BETWEEN 0.5 AND 100
        OR vendor.whatsapp_number !~ '^\+[1-9][0-9]{7,14}$')
  ) THEN RAISE EXCEPTION 'Vendor must remain verified and have valid location and contact details'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendors vendor
    WHERE vendor.id=p_vendor AND vendor.p0_fssai_required
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_documents document
        WHERE document.vendor_id=vendor.id AND document.document_type='food_certificate'
          AND document.document_number IS NOT NULL AND document.storage_path IS NOT NULL
          AND document.expiry_date>=current_date
      )
  ) THEN RAISE EXCEPTION 'A current required FSSAI certificate is needed before reactivation'; END IF;

  UPDATE public.vendors
  SET operational_status='active',marketplace_visible=true,p0_cancelled_at=NULL,connect_enabled=true,updated_at=now()
  WHERE id=p_vendor;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_data,after_data)
  SELECT p_actor,profile.role,'p0_vendor_reactivated','vendor',p_vendor::text,prior_state,
    jsonb_build_object('operational_status','active','marketplace_visible',true,'p0_cancelled_at',NULL)
  FROM public.profiles AS profile WHERE profile.id=p_actor;
END
$function$;

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
  WHERE code=p_plan_code AND active=true AND code IN ('crave','thrive','crown');
  IF selected_plan IS NULL THEN RAISE EXCEPTION 'Select an active Crave, Thrive or Crown plan'; END IF;

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

CREATE OR REPLACE FUNCTION public.p0_mark_upgrade_invitation(
  p_actor uuid,
  p_invitation uuid,
  p_delivery_status text,
  p_provider_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  invitation public.p0_upgrade_invitations;
  vendor_row public.vendors;
BEGIN
  IF p_delivery_status NOT IN ('sent','claim_pending','delivery_failed') THEN RAISE EXCEPTION 'Invalid invitation delivery status'; END IF;
  SELECT * INTO invitation FROM public.p0_upgrade_invitations WHERE id=p_invitation;
  IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT public.p0_actor_can(p_actor,'upgrade') THEN RAISE EXCEPTION 'Not authorized to send upgrade invitations'; END IF;
  SELECT * INTO vendor_row FROM public.vendors WHERE id=invitation.vendor_id FOR UPDATE;
  SELECT * INTO invitation FROM public.p0_upgrade_invitations WHERE id=p_invitation FOR UPDATE;
  IF invitation.status NOT IN ('pending','sent','claim_pending','delivery_failed') OR invitation.expires_at<=now()
     OR vendor_row.vendor_kind<>'p0_connect' OR vendor_row.p0_cancelled_at IS NOT NULL
     OR vendor_row.operational_status<>'active' OR vendor_row.verification_status<>'verified'
     OR NOT vendor_row.marketplace_visible THEN
    RAISE EXCEPTION 'Invitation is no longer eligible for delivery';
  END IF;
  UPDATE public.p0_upgrade_invitations
  SET status=p_delivery_status,provider_user_id=coalesce(p_provider_user_id,provider_user_id),updated_at=now()
  WHERE id=p_invitation;
END
$function$;

CREATE OR REPLACE FUNCTION public.p0_complete_upgrade(p_invitation uuid, p_invitee uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  invitation public.p0_upgrade_invitations;
  vendor_row public.vendors;
  invitee_email text;
  invitee_role public.app_role;
  previous_state jsonb;
BEGIN
  SELECT email INTO invitee_email FROM auth.users WHERE id=p_invitee;
  IF invitee_email IS NULL THEN RAISE EXCEPTION 'Authenticated invitee not found'; END IF;
  SELECT vendor_id INTO invitation.vendor_id FROM public.p0_upgrade_invitations WHERE id=p_invitation;
  IF invitation.vendor_id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  SELECT * INTO vendor_row FROM public.vendors WHERE id=invitation.vendor_id FOR UPDATE;
  SELECT * INTO invitation FROM public.p0_upgrade_invitations WHERE id=p_invitation FOR UPDATE;
  SELECT role INTO invitee_role FROM public.profiles WHERE id=p_invitee FOR UPDATE;

  IF invitation.status NOT IN ('sent','claim_pending') OR invitation.expires_at<=now()
     OR lower(invitation.invited_email)<>lower(invitee_email)
     OR invitation.provider_user_id IS DISTINCT FROM p_invitee THEN
    RAISE EXCEPTION 'Invitation is invalid, expired or belongs to another account';
  END IF;
  IF invitee_role IS DISTINCT FROM 'vendor'::public.app_role THEN
    RAISE EXCEPTION 'The invited account is not a vendor account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=p_invitee AND vendor_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.vendors WHERE owner_id=p_invitee) THEN
    RAISE EXCEPTION 'This account is already linked to a vendor; use the verified ownership-claim process';
  END IF;
  IF vendor_row.id IS NULL OR vendor_row.vendor_kind<>'p0_connect' OR vendor_row.owner_id IS NOT NULL
     OR vendor_row.p0_cancelled_at IS NOT NULL OR vendor_row.verification_status<>'verified'
     OR vendor_row.operational_status<>'active' OR NOT vendor_row.marketplace_visible THEN
    RAISE EXCEPTION 'Vendor is no longer eligible for upgrade';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_plans WHERE id=invitation.plan_id AND active=true) THEN
    RAISE EXCEPTION 'The selected subscription plan is no longer active';
  END IF;

  previous_state := jsonb_build_object(
    'id',vendor_row.id,'vendor_kind',vendor_row.vendor_kind,'plan_id',vendor_row.plan_id,
    'owner_id',vendor_row.owner_id,'verification_status',vendor_row.verification_status,
    'operational_status',vendor_row.operational_status,'marketplace_visible',vendor_row.marketplace_visible
  );
  IF vendor_row.whatsapp_number IS NOT NULL THEN
    INSERT INTO public.p0_vendor_history(vendor_id,historical_whatsapp_number,reason,recorded_by)
    VALUES(vendor_row.id,vendor_row.whatsapp_number,'p0_to_subscription_upgrade',p_invitee);
  END IF;
  UPDATE public.vendors
  SET owner_id=p_invitee,plan_id=invitation.plan_id,vendor_kind='subscription',
      connect_enabled=false,whatsapp_number=NULL,updated_at=now()
  WHERE id=vendor_row.id;
  UPDATE public.profiles SET vendor_id=vendor_row.id,updated_at=now() WHERE id=p_invitee;
  UPDATE public.p0_upgrade_invitations SET status='completed',updated_at=now() WHERE id=p_invitation;

  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_data,after_data)
  VALUES(p_invitee,'vendor','p0_vendor_upgraded','vendor',vendor_row.id::text,previous_state,
    jsonb_build_object('vendor_kind','subscription','plan_id',invitation.plan_id,'owner_id',p_invitee,'connect_enabled',false));
  RETURN vendor_row.id;
END
$function$;

CREATE OR REPLACE FUNCTION public.review_vendor_and_notify(target_vendor uuid, decision text, review_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  owner uuid;
  creator uuid;
  vendor_kind_value text;
  verified boolean;
  cancelled_at timestamptz;
  actor uuid := auth.uid();
BEGIN
  IF decision NOT IN ('verified','changes_required','rejected','under_review') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  SELECT owner_id,p0_created_by,vendor_kind,p0_cancelled_at
    INTO owner,creator,vendor_kind_value,cancelled_at
  FROM public.vendors WHERE id=target_vendor FOR UPDATE;
  IF vendor_kind_value IS NULL THEN RAISE EXCEPTION 'Vendor not found'; END IF;

  IF vendor_kind_value='p0_connect' AND cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cancelled P0 vendors must be reactivated before review';
  END IF;

  IF vendor_kind_value='p0_connect' THEN
    IF NOT public.p0_actor_can(actor,'review') THEN RAISE EXCEPTION 'Not authorized to review P0 vendors'; END IF;
    IF creator=actor THEN RAISE EXCEPTION 'The P0 creator cannot approve their own vendor'; END IF;
    IF decision='verified' AND (
      NOT EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id=target_vendor AND v.latitude BETWEEN -90 AND 90 AND v.longitude BETWEEN -180 AND 180
          AND v.service_radius_km BETWEEN 0.5 AND 100
          AND v.whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
      )
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id=target_vendor AND v.p0_fssai_required
          AND NOT EXISTS (
            SELECT 1 FROM public.vendor_documents d
            WHERE d.vendor_id=v.id AND d.document_type='food_certificate'
              AND d.document_number IS NOT NULL AND d.storage_path IS NOT NULL
              AND d.expiry_date>=current_date
          )
      )
    ) THEN RAISE EXCEPTION 'P0 vendor needs valid coordinates, WhatsApp and any required current FSSAI certificate'; END IF;
  ELSIF public.current_app_role() NOT IN ('operations','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  verified := decision='verified';
  UPDATE public.vendors
  SET verification_status=decision::public.verification_status,
      operational_status=(CASE WHEN verified THEN 'active' ELSE 'inactive' END)::public.operational_status,
      marketplace_visible=verified,
      connect_enabled=(vendor_kind_value='p0_connect' AND verified),
      store_open_today=CASE WHEN verified THEN store_open_today ELSE false END,
      updated_at=now()
  WHERE id=target_vendor;

  IF owner IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id,kind,title,body,entity_type,entity_id)
    VALUES(owner,'vendor_verification',
      CASE WHEN verified THEN 'Vendor verified' ELSE 'Verification update' END,
      CASE WHEN verified THEN 'Your store is approved. Open for the day and publish products.'
        ELSE coalesce(review_note,'Review the Operations decision and update the requested information.') END,
      'vendor',target_vendor::text);
  END IF;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_data)
  VALUES(actor,public.current_app_role(),'vendor_verification','vendor',target_vendor::text,
    jsonb_build_object('decision',decision,'note',review_note,'vendor_kind',vendor_kind_value));
END
$function$;

-- The added discriminator makes older clients fail closed until this migration is applied.
-- Do not use CASCADE: an unexpected database dependency must abort and roll back this transaction.
DROP FUNCTION IF EXISTS public.connect_vendors_nearby(double precision,double precision);
CREATE FUNCTION public.connect_vendors_nearby(customer_lat double precision, customer_lng double precision)
RETURNS TABLE(
  vendor_kind text,vendor_id uuid,vendor_name text,category text,description text,locality text,address text,
  latitude double precision,longitude double precision,whatsapp_number text,operating_hours jsonb,
  logo_url text,distance_km double precision,service_radius_km numeric,store_open_today boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
  SELECT v.vendor_kind::text,v.id,v.name,v.category,v.description,v.locality,v.address,v.latitude::double precision,
    v.longitude::double precision,v.whatsapp_number,v.operating_hours,v.logo_url,d.distance_km,
    v.service_radius_km,v.store_open_today
  FROM public.vendors v
  CROSS JOIN LATERAL (
    SELECT 6371.0*2*asin(sqrt(least(1.0,greatest(0.0,
      power(sin(radians(v.latitude::double precision-customer_lat)/2),2)
      +cos(radians(customer_lat))*cos(radians(v.latitude::double precision))
      *power(sin(radians(v.longitude::double precision-customer_lng)/2),2)
    )))) AS distance_km
  ) d
  WHERE customer_lat BETWEEN -90 AND 90 AND customer_lng BETWEEN -180 AND 180
    AND v.vendor_kind='p0_connect' AND v.connect_enabled
    AND v.verification_status='verified' AND v.operational_status='active'
    AND v.marketplace_visible AND v.p0_cancelled_at IS NULL
    AND v.latitude BETWEEN -90 AND 90 AND v.longitude BETWEEN -180 AND 180
    AND v.whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
    AND d.distance_km<=v.service_radius_km
  ORDER BY d.distance_km
$function$;

CREATE OR REPLACE FUNCTION public.track_vendor_whatsapp_click(target_vendor_id uuid, click_source text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
DECLARE
  new_event_id uuid;
  current_customer_id uuid := auth.uid();
BEGIN
  IF click_source IS NULL OR click_source NOT IN ('map','vendor_profile','search') THEN
    RAISE EXCEPTION 'Invalid WhatsApp click source';
  END IF;
  IF current_customer_id IS NULL
     OR public.current_app_role() IS DISTINCT FROM 'customer'::public.app_role THEN
    RAISE EXCEPTION 'Only authenticated customers may record WhatsApp contact clicks';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id=target_vendor_id AND v.vendor_kind='p0_connect' AND v.connect_enabled
      AND v.verification_status='verified' AND v.operational_status='active'
      AND v.marketplace_visible AND v.p0_cancelled_at IS NULL
      AND v.latitude BETWEEN -90 AND 90 AND v.longitude BETWEEN -180 AND 180
      AND v.whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ) THEN RAISE EXCEPTION 'Vendor is not available for Connect contact'; END IF;

  INSERT INTO public.vendor_whatsapp_click_events(vendor_id,customer_id,source)
  VALUES(target_vendor_id,current_customer_id,click_source)
  RETURNING id INTO new_event_id;
  RETURN new_event_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.marketplace_menu_nearby(customer_lat double precision, customer_lng double precision)
RETURNS TABLE(
  item_id uuid,vendor_id uuid,vendor_name text,item_name text,category text,unit text,
  quantity_step numeric,stock_quantity numeric,image_url text,customer_price numeric,
  calories_per_unit numeric,protein_g numeric,carbs_g numeric,fat_g numeric,fibre_g numeric,
  dietary_tags text[],pack_amount numeric,pack_measure text,delivery_enabled boolean,
  pickup_enabled boolean,distance_km numeric,vendor_lat double precision,vendor_lng double precision,
  vendor_plan_code text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
  WITH eligible AS (
    SELECT item.id AS item_id,vendor.id AS vendor_id,vendor.name AS vendor_name,
      item.name AS item_name,item.category,item.unit,item.quantity_step,item.stock_quantity,item.image_url,
      round(item.vendor_base_price*(1+coalesce(markup.markup_percent,0)/100),2) AS customer_price,
      item.calories_per_unit,item.protein_g,item.carbs_g,item.fat_g,item.fibre_g,item.dietary_tags,
      item.pack_amount,item.pack_measure,vendor.delivery_enabled,vendor.pickup_enabled,
      vendor.service_radius_km,vendor.latitude::double precision AS vendor_lat,
      vendor.longitude::double precision AS vendor_lng,coalesce(plan.code,'crave') AS vendor_plan_code,
      6371*2*asin(sqrt(
        power(sin(radians((vendor.latitude::double precision-customer_lat)/2)),2)
        +cos(radians(customer_lat))*cos(radians(vendor.latitude::double precision))
        *power(sin(radians((vendor.longitude::double precision-customer_lng)/2)),2)
      )) AS calculated_distance_km
    FROM public.vendor_menu_items item
    JOIN public.vendors vendor ON vendor.id=item.vendor_id
    LEFT JOIN public.vendor_item_markups markup ON markup.menu_item_id=item.id
    LEFT JOIN public.vendor_plans plan ON plan.id=vendor.plan_id
    WHERE customer_lat BETWEEN -90 AND 90 AND customer_lng BETWEEN -180 AND 180
      AND vendor.vendor_kind='subscription'
      AND coalesce(plan.code,'crave')<>'taster'
      AND vendor.latitude IS NOT NULL AND vendor.longitude IS NOT NULL
      AND vendor.latitude BETWEEN -90 AND 90 AND vendor.longitude BETWEEN -180 AND 180
      AND item.active AND item.stock_quantity>0
      AND vendor.verification_status='verified' AND vendor.operational_status='active'
      AND vendor.marketplace_visible AND vendor.store_open_today
      AND (vendor.delivery_enabled OR vendor.pickup_enabled)
  )
  SELECT item_id,vendor_id,vendor_name,item_name,category,unit,quantity_step,stock_quantity,image_url,
    customer_price,calories_per_unit,protein_g,carbs_g,fat_g,fibre_g,dietary_tags,pack_amount,
    pack_measure,delivery_enabled,pickup_enabled,round(calculated_distance_km::numeric,2),
    vendor_lat,vendor_lng,vendor_plan_code
  FROM eligible
  WHERE calculated_distance_km<=service_radius_km
  ORDER BY calculated_distance_km,item_name
$function$;

DROP POLICY IF EXISTS vendors_customer_read ON public.vendors;
CREATE POLICY vendors_customer_read ON public.vendors FOR SELECT
USING (
  (vendor_kind='subscription' AND (
    (verification_status='verified' AND operational_status='active' AND marketplace_visible)
    OR owner_id=auth.uid() OR public.current_app_role() IN ('operations','admin')
  ))
  OR (
    vendor_kind='p0_connect'
    AND (
      public.current_app_role()='admin'
      OR (
        public.current_app_role()='operations'
        AND (
          public.p0_current_actor_can('create') OR public.p0_current_actor_can('review')
          OR public.p0_current_actor_can('cancel') OR public.p0_current_actor_can('reactivate')
          OR public.p0_current_actor_can('upgrade') OR public.p0_current_actor_can('upload')
        )
      )
    )
  )
);

DROP POLICY IF EXISTS vendors_owner_insert ON public.vendors;
CREATE POLICY vendors_owner_insert ON public.vendors FOR INSERT
WITH CHECK (
  vendor_kind='subscription' AND owner_id=auth.uid()
  AND public.current_app_role()='vendor'
);

DROP POLICY IF EXISTS vendors_operations_insert ON public.vendors;
CREATE POLICY vendors_operations_insert ON public.vendors FOR INSERT
WITH CHECK (
  vendor_kind='subscription' AND owner_id IS NOT NULL
  AND public.current_app_role() IN ('operations','admin')
);

DROP POLICY IF EXISTS vendors_owner_draft_update ON public.vendors;
CREATE POLICY vendors_owner_draft_update ON public.vendors FOR UPDATE
USING (
  vendor_kind='subscription'
  AND (owner_id=auth.uid() OR public.current_app_role() IN ('operations','admin'))
)
WITH CHECK (
  vendor_kind='subscription'
  AND (owner_id=auth.uid() OR public.current_app_role() IN ('operations','admin'))
);

DROP POLICY IF EXISTS documents_vendor_ops_read ON public.vendor_documents;
CREATE POLICY documents_vendor_ops_read ON public.vendor_documents FOR SELECT
USING (
  public.owns_vendor(vendor_id)
  OR (
    public.current_app_role() IN ('operations','admin')
    AND (
      EXISTS (SELECT 1 FROM public.vendors v WHERE v.id=vendor_id AND v.vendor_kind='subscription')
      OR public.current_app_role()='admin'
      OR (
        public.current_app_role()='operations'
        AND (public.p0_current_actor_can('review') OR public.p0_current_actor_can('upload'))
      )
    )
  )
);

DROP POLICY IF EXISTS documents_ops_update ON public.vendor_documents;
CREATE POLICY documents_ops_update ON public.vendor_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id=vendor_id
      AND (
        (v.vendor_kind='subscription' AND public.current_app_role() IN ('operations','admin'))
        OR (v.vendor_kind='p0_connect' AND (
          public.current_app_role()='admin'
          OR (public.current_app_role()='operations' AND public.p0_current_actor_can('review'))
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id=vendor_id
      AND (
        (v.vendor_kind='subscription' AND public.current_app_role() IN ('operations','admin'))
        OR (v.vendor_kind='p0_connect' AND (
          public.current_app_role()='admin'
          OR (public.current_app_role()='operations' AND public.p0_current_actor_can('review'))
        ))
      )
  )
);

DROP POLICY IF EXISTS vendor_certificate_read ON storage.objects;
CREATE POLICY vendor_certificate_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='vendor-certificates'
  AND (
    (storage.foldername(name))[1]=auth.uid()::text
    OR public.current_app_role()='admin'
    OR (
      public.current_app_role()='operations'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.vendors v
          WHERE v.id::text=(storage.foldername(name))[1] AND v.vendor_kind='p0_connect'
        )
        OR public.p0_current_actor_can('review')
        OR public.p0_current_actor_can('upload')
      )
    )
  )
);

DROP POLICY IF EXISTS vendor_certificate_operations_upload ON storage.objects;
CREATE POLICY vendor_certificate_operations_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='vendor-certificates'
  AND (
    public.current_app_role()='admin'
    OR (
      public.current_app_role()='operations'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.vendors v
          WHERE v.id::text=(storage.foldername(name))[1] AND v.vendor_kind='p0_connect'
        )
        OR public.p0_current_actor_can('upload')
      )
    )
  )
);

REVOKE ALL ON FUNCTION public.p0_actor_can(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.p0_actor_can(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.p0_current_actor_can(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p0_current_actor_can(text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.p0_set_operations_permissions(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_create_vendor(uuid,text,text,text,text,text,double precision,double precision,numeric,text,text,text,boolean,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_cancel_vendor(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_reactivate_vendor(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_start_upgrade_invitation(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_mark_upgrade_invitation(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p0_complete_upgrade(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.p0_set_operations_permissions(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_create_vendor(uuid,text,text,text,text,text,double precision,double precision,numeric,text,text,text,boolean,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_cancel_vendor(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_reactivate_vendor(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_start_upgrade_invitation(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_mark_upgrade_invitation(uuid,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_complete_upgrade(uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.connect_vendors_nearby(double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_vendors_nearby(double precision,double precision) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.track_vendor_whatsapp_click(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_vendor_whatsapp_click(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.marketplace_menu_nearby(double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.marketplace_menu_nearby(double precision,double precision) TO authenticated;

ALTER TABLE public.vendor_whatsapp_click_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vendor_whatsapp_click_events FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';

COMMIT;
