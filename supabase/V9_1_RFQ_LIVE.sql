-- V9.1 — RFQ, live and Package 3 only.
--
-- Until now the monthly-requirement (RFQ) flow only existed in the browser's local
-- data, so a customer's RFQ could never reach a vendor signed in somewhere else.
-- This migration makes it real and enforces the rules in the database:
--
--   1. Only Package 3 vendors take part. Package 3 is the existing "premium" plan
--      (Package 1 = launch, Package 2 = growth). rfq_access is switched off for
--      launch and growth and on for premium; vendor_has_entitlement() reads it.
--   2. publish_requirement()  — the customer's RFQ is saved with a private delivery
--      pin and matched to vendors in ONE step: verified, active, on a plan with
--      rfq_access, and the customer is inside the vendor's own service radius
--      (a vendor with a 10 km radius sees RFQs from customers within 10 km).
--   3. Vendors read an RFQ only through an invitation AND while their plan still has
--      rfq_access. (The old policy compared requirement_id to the invitation's own id,
--      so no vendor could ever read a requirement. Fixed here.)
--   4. submit_quote()  — a matched vendor prices each item. Checks invitation,
--      Package 3, open status and the deadline. Raw vendor prices stay sealed.
--   5. accept_quote()  — only the customer who posted the RFQ picks the winner. It
--      creates the order (status awarded) with items and a pending payment, marks the
--      other quotes not selected, and closes the RFQ. Safe against a double click.
--
-- The customer's delivery pin is stored in requirement_pins, readable only by the
-- customer and staff, so vendors never see exact coordinates.
-- Additive and safe to re-run. Also removes anonymous access from the Food Shorts functions.

-- ---------------------------------------------------------------- Package 3 only
update public.vendor_plans set entitlements = entitlements || '{"rfq_access": false}'::jsonb where code in ('launch', 'growth');
update public.vendor_plans set entitlements = entitlements || '{"rfq_access": true}'::jsonb where code = 'premium';

create or replace function public.vendor_has_entitlement(p_vendor uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (p.entitlements ->> p_key)::boolean from public.vendors v join public.vendor_plans p on p.id = v.plan_id where v.id = p_vendor), false)
$$;
revoke all on function public.vendor_has_entitlement(uuid, text) from public, anon;
grant execute on function public.vendor_has_entitlement(uuid, text) to authenticated;

create or replace function public.distance_km(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(least(1, sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))
$$;

-- ---------------------------------------------------------------- tables
alter table public.customer_requirements add column if not exists invited_count int not null default 0;
alter table public.customer_requirements add column if not exists awarded_quote_id uuid;

create table if not exists public.requirement_pins (
  requirement_id uuid primary key references public.customer_requirements(id) on delete cascade,
  latitude numeric not null,
  longitude numeric not null
);
alter table public.requirement_pins enable row level security;
drop policy if exists requirement_pins_owner_read on public.requirement_pins;
create policy requirement_pins_owner_read on public.requirement_pins for select
  using (exists (select 1 from public.customer_requirements r where r.id = requirement_id and (r.customer_id = auth.uid() or public.current_app_role() in ('operations', 'admin'))));

-- ---------------------------------------------------------------- read access
-- A vendor reads an RFQ only through an invitation, and only while on a plan with rfq_access.
-- NB: the invitation's own id column is why the old policy never matched; qualify the outer table.
drop policy if exists requirements_customer_ops_read on public.customer_requirements;
create policy requirements_customer_ops_read on public.customer_requirements for select using (
  customer_id = auth.uid()
  or public.current_app_role() in ('operations', 'admin')
  or exists (select 1 from public.rfq_vendor_invitations i
             where i.requirement_id = customer_requirements.id and public.owns_vendor(i.vendor_id) and public.vendor_has_entitlement(i.vendor_id, 'rfq_access'))
);
drop policy if exists requirement_items_access on public.requirement_items;
create policy requirement_items_access on public.requirement_items for select using (exists (
  select 1 from public.customer_requirements r where r.id = requirement_items.requirement_id and (
    r.customer_id = auth.uid() or public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.rfq_vendor_invitations i where i.requirement_id = r.id and public.owns_vendor(i.vendor_id) and public.vendor_has_entitlement(i.vendor_id, 'rfq_access'))
  )));

-- Direct quote writes need the same Package 3 check (the normal path is submit_quote()).
drop policy if exists quotes_vendor_write on public.vendor_quotes;
create policy quotes_vendor_write on public.vendor_quotes for all using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id) and public.vendor_has_entitlement(vendor_id, 'rfq_access')
    and exists (select 1 from public.rfq_vendor_invitations i where i.requirement_id = vendor_quotes.requirement_id and i.vendor_id = vendor_quotes.vendor_id));

-- ---------------------------------------------------------------- publish + match
create or replace function public.publish_requirement(
  p_title text, p_locality text, p_lat numeric, p_lng numeric, p_delivery_date date,
  p_fulfilment text, p_quote_deadline timestamptz, p_items jsonb
) returns table (req_id uuid, invited int)
language plpgsql security definer set search_path = public as $$
declare rid uuid; n int := 0; elem jsonb;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to publish an RFQ'; end if;
  if p_lat is null or p_lng is null then raise exception 'Set your delivery pin first so vendors near you can be found'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Give the RFQ a title'; end if;
  if p_fulfilment not in ('vendor_delivery', 'self_pickup') then raise exception 'Choose delivery or pickup'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item'; end if;
  if p_quote_deadline is null or p_quote_deadline <= now() then raise exception 'The quote closing date must be in the future'; end if;
  if p_delivery_date is null or p_delivery_date <= current_date then raise exception 'The delivery date must be after today'; end if;
  if p_quote_deadline::date > p_delivery_date then raise exception 'Quotes must close on or before the delivery date'; end if;

  insert into public.customer_requirements(customer_id, title, locality, delivery_date, fulfilment_mode, quote_deadline, status)
  values (auth.uid(), left(trim(p_title), 120), coalesce(nullif(trim(p_locality), ''), 'Near you'), p_delivery_date, p_fulfilment, p_quote_deadline, 'quoting')
  returning id into rid;
  insert into public.requirement_pins(requirement_id, latitude, longitude) values (rid, p_lat, p_lng);

  for elem in select value from jsonb_array_elements(p_items) loop
    if coalesce(trim(elem ->> 'name'), '') = '' then continue; end if;
    insert into public.requirement_items(requirement_id, product_name, preferred_brand, quantity, unit, substitute_allowed, customer_note)
    values (rid, left(trim(elem ->> 'name'), 120), nullif(elem ->> 'brand', ''), greatest(coalesce((elem ->> 'quantity')::numeric, 1), 0.001), coalesce(nullif(elem ->> 'unit', ''), 'unit'), false, null);
  end loop;
  if not exists (select 1 from public.requirement_items where requirement_id = rid) then raise exception 'Add at least one item with a name'; end if;

  -- match: verified, active, visible, Package 3, and the customer is inside THIS vendor's own radius
  insert into public.rfq_vendor_invitations(requirement_id, vendor_id)
  select rid, v.id from public.vendors v
  where v.verification_status = 'verified' and v.operational_status = 'active' and v.marketplace_visible
    and v.latitude is not null and v.longitude is not null
    and public.vendor_has_entitlement(v.id, 'rfq_access')
    and public.distance_km(p_lat::double precision, p_lng::double precision, v.latitude::double precision, v.longitude::double precision) <= v.service_radius_km::double precision;
  get diagnostics n = row_count;
  update public.customer_requirements set invited_count = n where id = rid;

  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  select v.owner_id, 'rfq', 'New local RFQ', left(trim(p_title), 120) || ' closes ' || to_char(p_quote_deadline, 'DD Mon') || '. Send your best prices.', 'requirement', rid::text
  from public.rfq_vendor_invitations i join public.vendors v on v.id = i.vendor_id where i.requirement_id = rid;

  return query select rid, n;
end;
$$;
revoke all on function public.publish_requirement(text, text, numeric, numeric, date, text, timestamptz, jsonb) from public, anon;
grant execute on function public.publish_requirement(text, text, numeric, numeric, date, text, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------- vendor quote
-- p_items: [{ "requirement_item_id": uuid, "available": true, "unit_price": 62.5, "brand": "optional" }]
create or replace function public.submit_quote(p_requirement uuid, p_items jsonb, p_delivery_fee numeric default 0, p_valid_until timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.vendors; r public.customer_requirements; qid uuid; total numeric := 0; ri record; supplied jsonb; avail boolean; price numeric;
begin
  select * into v from public.vendors where owner_id = auth.uid() order by created_at limit 1;
  if v.id is null then raise exception 'Only a vendor can send a quotation'; end if;
  if not public.vendor_has_entitlement(v.id, 'rfq_access') then raise exception 'Quotations are available on Package 3'; end if;
  if v.verification_status <> 'verified' or v.operational_status <> 'active' then raise exception 'Your store must be verified and active to quote'; end if;
  select * into r from public.customer_requirements where id = p_requirement for update;
  if r.id is null or not exists (select 1 from public.rfq_vendor_invitations where requirement_id = r.id and vendor_id = v.id) then raise exception 'This RFQ was not sent to your store'; end if;
  if r.status not in ('quoting', 'quotes_received') then raise exception 'This RFQ is no longer open'; end if;
  if r.quote_deadline < now() then raise exception 'This RFQ is closed'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Send a price for each item'; end if;
  if coalesce(p_delivery_fee, 0) < 0 then raise exception 'The delivery fee cannot be negative'; end if;

  insert into public.vendor_quotes(requirement_id, vendor_id, vendor_total, delivery_fee, status, valid_until, submitted_at)
  values (r.id, v.id, 0, coalesce(p_delivery_fee, 0), 'submitted', coalesce(p_valid_until, r.quote_deadline + interval '7 days'), now())
  on conflict (requirement_id, vendor_id) do update
    set delivery_fee = excluded.delivery_fee, status = 'submitted', valid_until = excluded.valid_until, submitted_at = now(), updated_at = now()
  returning id into qid;
  delete from public.vendor_quote_items where quote_id = qid;

  for ri in select * from public.requirement_items where requirement_id = r.id loop
    select value into supplied from jsonb_array_elements(p_items) where (value ->> 'requirement_item_id')::uuid = ri.id limit 1;
    if supplied is null then avail := false; price := 0;
    else
      avail := coalesce((supplied ->> 'available')::boolean, true);
      price := coalesce((supplied ->> 'unit_price')::numeric, 0);
      if avail and price <= 0 then raise exception 'Enter a price for %', ri.product_name; end if;
      if price < 0 then raise exception 'Prices cannot be negative'; end if;
    end if;
    insert into public.vendor_quote_items(quote_id, requirement_item_id, offered_brand, available, vendor_unit_price)
    values (qid, ri.id, nullif(supplied ->> 'brand', ''), avail, case when avail then price else 0 end);
    if avail then total := total + price * ri.quantity; end if;
  end loop;
  if total <= 0 then raise exception 'Quote at least one item'; end if;
  update public.vendor_quotes set vendor_total = round(total, 2) where id = qid;
  update public.rfq_vendor_invitations set status = 'responded', responded_at = now(), viewed_at = coalesce(viewed_at, now()) where requirement_id = r.id and vendor_id = v.id;
  update public.customer_requirements set status = 'quotes_received', updated_at = now() where id = r.id;
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  values (r.customer_id, 'rfq', 'A vendor sent a quotation', v.name || ' quoted for "' || r.title || '". Compare and choose.', 'requirement', r.id::text);
  return qid;
end;
$$;
revoke all on function public.submit_quote(uuid, jsonb, numeric, timestamptz) from public, anon;
grant execute on function public.submit_quote(uuid, jsonb, numeric, timestamptz) to authenticated;

-- ---------------------------------------------------------------- customer accepts
create or replace function public.accept_quote(p_quote uuid)
returns table (o_id uuid, o_number text, o_total numeric)
language plpgsql security definer set search_path = public as $$
declare q public.vendor_quotes; r public.customer_requirements; vend public.vendors; oid uuid; onum text; markup numeric; total numeric;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as the customer who posted this RFQ'; end if;
  select * into q from public.vendor_quotes where id = p_quote;
  if q.id is null then raise exception 'Quotation not found'; end if;
  select * into r from public.customer_requirements where id = q.requirement_id for update;   -- serialises double clicks
  if r.customer_id <> auth.uid() then raise exception 'This is not your RFQ'; end if;
  if r.status = 'awarded' then raise exception 'This RFQ already has a winner'; end if;
  select * into q from public.vendor_quotes where id = p_quote;                                 -- re-read after the lock
  if q.status <> 'submitted' then raise exception 'This quotation is not open for selection'; end if;
  if q.valid_until is not null and q.valid_until < now() then raise exception 'This quotation has expired'; end if;
  if r.delivery_date <= current_date then raise exception 'The delivery date has passed. Publish a new RFQ'; end if;
  select * into vend from public.vendors where id = q.vendor_id;

  markup := round(q.vendor_total * q.operations_markup_percent / 100, 2);
  total := round(q.vendor_total + markup + q.delivery_fee + q.tax_amount, 2);
  onum := 'RFQ-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into public.orders(order_number, requirement_id, quote_id, customer_id, vendor_id, vendor_base_total, markup_total, tax_amount, delivery_fee, customer_total, fulfilment_mode, scheduled_date, scheduled_slot, status)
  values (onum, r.id, q.id, r.customer_id, q.vendor_id, q.vendor_total, markup, q.tax_amount, q.delivery_fee, total, r.fulfilment_mode, r.delivery_date, 'Vendor to confirm', 'awarded')
  returning id into oid;
  insert into public.order_items(order_id, product_name, quantity, unit, vendor_base_price, markup_percent, customer_price)
  select oid, ri.product_name, ri.quantity, ri.unit, qi.vendor_unit_price,
         coalesce(nullif(qi.operations_markup_percent, 0), q.operations_markup_percent),
         round(qi.vendor_unit_price * (1 + coalesce(nullif(qi.operations_markup_percent, 0), q.operations_markup_percent) / 100), 2)
  from public.vendor_quote_items qi join public.requirement_items ri on ri.id = qi.requirement_item_id
  where qi.quote_id = q.id and qi.available;
  insert into public.payments(order_id, customer_id, amount, status, provider) values (oid, r.customer_id, total, 'pending', 'checkout');

  update public.vendor_quotes set status = case when id = q.id then 'selected' else 'not_selected' end, updated_at = now() where requirement_id = r.id and status = 'submitted';
  update public.customer_requirements set status = 'awarded', awarded_quote_id = q.id, updated_at = now() where id = r.id;
  update public.rfq_vendor_invitations set status = case when vendor_id = q.vendor_id then 'awarded' else 'closed' end where requirement_id = r.id;

  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  values (vend.owner_id, 'rfq', 'RFQ awarded to your store', onum || ' for "' || r.title || '" was awarded to you.', 'order', oid::text),
         (r.customer_id, 'payment', 'Complete payment', onum || ' is ready for payment.', 'order', oid::text);
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  select v.owner_id, 'rfq', 'RFQ closed', '"' || r.title || '" was awarded to another vendor.', 'requirement', r.id::text
  from public.vendor_quotes lq join public.vendors v on v.id = lq.vendor_id where lq.requirement_id = r.id and lq.id <> q.id;
  return query select oid, onum, total;
end;
$$;
revoke all on function public.accept_quote(uuid) from public, anon;
grant execute on function public.accept_quote(uuid) to authenticated;

-- ---------------------------------------------------------------- Food Shorts hardening (from V8.4)
revoke execute on function public.nearby_food_shorts(double precision, double precision, numeric, int) from anon;
revoke execute on function public.create_food_short(text, text, text, text, numeric, numeric, uuid) from anon;
revoke execute on function public.record_short_view(uuid) from anon;
