-- Audit trail for views of customer details, a read function for the Audit log page, and notes from Operations to a vendor.
--
-- Additive and safe to re-run. Needs the base schema (profiles, vendors, audit_logs, notifications).
-- No new tables: events go into public.audit_logs and notes reach the vendor as a notification.
-- Every function checks the caller's role; none of them can be used by customers or vendors.

create or replace function public.assert_review_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() not in ('operations', 'admin') then raise exception 'Only Operations or Super Admin can do this'; end if;
end;
$$;

-- Record that a staff member opened a customer's details. p_customer is the customer's email, p_context says where.
create or replace function public.log_customer_data_view(p_customer text, p_context text default 'Users')
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_review_staff();
  if p_customer is null or btrim(p_customer) = '' then raise exception 'Say which customer was viewed'; end if;
  insert into public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, after_data)
  values (auth.uid(), public.current_app_role(), 'viewed_customer_details', 'customer', lower(btrim(p_customer)), jsonb_build_object('context', left(coalesce(p_context, ''), 80)));
end;
$$;

-- The latest audit events with the name of who did it, for the Audit log page.
create or replace function public.audit_trail(p_limit int default 200)
returns table (id bigint, created_at timestamptz, actor_name text, actor_role text, action text, entity_type text, entity_id text, detail jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_review_staff();
  return query
  select a.id, a.created_at, coalesce(p.full_name, 'System'), a.actor_role::text, a.action, a.entity_type, a.entity_id, coalesce(a.after_data, '{}'::jsonb)
  from public.audit_logs a left join public.profiles p on p.id = a.actor_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

-- A note from Operations to a vendor, sent as a notification to the owner and written to the audit trail.
create or replace function public.send_vendor_note(p_vendor uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid; shop text; clean text := left(btrim(coalesce(p_note, '')), 500);
begin
  perform public.assert_review_staff();
  if clean = '' then raise exception 'Write the note first'; end if;
  select v.owner_id, v.name into owner, shop from public.vendors v where v.id = p_vendor;
  if not found then raise exception 'That vendor was not found'; end if;
  if owner is null then raise exception 'This vendor has no login to notify'; end if;
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  values (owner, 'general', 'A note from ShePlates Operations', clean, 'vendor', p_vendor::text);
  insert into public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, after_data)
  values (auth.uid(), public.current_app_role(), 'sent_vendor_note', 'vendor', p_vendor::text, jsonb_build_object('vendor', shop));
end;
$$;

revoke all on function public.assert_review_staff(), public.log_customer_data_view(text, text), public.audit_trail(int), public.send_vendor_note(uuid, text) from public;
grant execute on function public.log_customer_data_view(text, text), public.audit_trail(int), public.send_vendor_note(uuid, text) to authenticated;
