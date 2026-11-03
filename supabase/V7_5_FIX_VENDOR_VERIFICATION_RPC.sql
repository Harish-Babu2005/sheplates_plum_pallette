-- V7.5 — fix a real, previously-latent bug: Operations/Super Admin could
-- never actually verify a vendor. review_vendor_and_notify() (V4_UPGRADE.sql)
-- assigns the `decision` and derived operational-status text values directly
-- to the vendors.verification_status / operational_status columns, which are
-- custom Postgres enum types (verification_status / operational_status), not
-- text. Postgres does not implicitly cast text to a custom enum in an UPDATE
-- assignment, so every call failed with:
--   42804 column "verification_status" is of type verification_status
--   but expression is of type text
-- Reproduced directly against this project's database before this fix.
-- Root cause fix: explicit ::verification_status / ::operational_status casts.

create or replace function public.review_vendor_and_notify(target_vendor uuid, decision text, review_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare owner uuid; verified boolean;
begin
  if public.current_app_role() not in ('operations','admin') then raise exception 'Not authorised'; end if;
  if decision not in ('verified','changes_required','rejected','under_review') then raise exception 'Invalid decision'; end if;
  verified := decision='verified';
  update public.vendors set verification_status=decision::verification_status,
    operational_status=(case when verified then 'active' else 'inactive' end)::operational_status,
    marketplace_visible=verified, store_open_today=case when verified then store_open_today else false end, updated_at=now()
  where id=target_vendor returning owner_id into owner;
  if owner is null then raise exception 'Vendor not found'; end if;
  insert into public.notifications(recipient_id,kind,title,body,entity_type,entity_id)
  values(owner,'vendor_verification',case when verified then 'Vendor verified' else 'Verification update' end,
    case when verified then 'Your store is approved. Open for the day and publish products.' else coalesce(review_note,'Review the Operations decision in Verification.') end,
    'vendor',target_vendor::text);
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_data)
  values(auth.uid(),public.current_app_role(),'vendor_verification','vendor',target_vendor::text,jsonb_build_object('decision',decision,'note',review_note));
end $$;
grant execute on function public.review_vendor_and_notify(uuid,text,text) to authenticated;
