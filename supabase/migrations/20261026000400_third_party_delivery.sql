alter table public.orders drop constraint if exists orders_fulfilment_mode_check;
alter table public.orders
  add constraint orders_fulfilment_mode_check
  check (fulfilment_mode in ('vendor_delivery', 'self_pickup', 'third_party_delivery'));

alter table public.product_schedules drop constraint if exists product_schedules_fulfilment_mode_check;
alter table public.product_schedules
  add constraint product_schedules_fulfilment_mode_check
  check (fulfilment_mode in ('vendor_delivery', 'self_pickup', 'third_party_delivery'));

create table if not exists public.third_party_delivery_requests (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_notes text not null check (char_length(trim(customer_notes)) between 1 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'delivered', 'expired', 'locked')),
  accepted_at timestamptz,
  code_hash text,
  code_expires_at timestamptz,
  code_issued_count integer not null default 0 check (code_issued_count between 0 and 5),
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists third_party_delivery_vendor_status_idx
  on public.third_party_delivery_requests (vendor_id, status, created_at desc);
create index if not exists third_party_delivery_customer_idx
  on public.third_party_delivery_requests (customer_id, created_at desc);

alter table public.third_party_delivery_requests enable row level security;
revoke all on table public.third_party_delivery_requests from public, anon, authenticated;
grant select (
  order_id, customer_id, vendor_id, customer_notes, status, accepted_at,
  code_expires_at, code_issued_count, delivered_at, created_at, updated_at
) on public.third_party_delivery_requests to authenticated;

drop policy if exists third_party_delivery_party_read on public.third_party_delivery_requests;
create policy third_party_delivery_party_read
  on public.third_party_delivery_requests for select
  using (
    customer_id = auth.uid()
    or public.owns_vendor(vendor_id)
    or public.current_app_role() in ('operations', 'admin')
  );

create or replace function public.guard_third_party_delivery_request()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.orders o
    where o.id = new.order_id
      and o.customer_id = new.customer_id
      and o.vendor_id = new.vendor_id
      and o.fulfilment_mode = 'third_party_delivery'
  ) then
    raise exception 'Delivery request does not match a third-party order';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_third_party_delivery_request on public.third_party_delivery_requests;
create trigger guard_third_party_delivery_request
  before insert or update on public.third_party_delivery_requests
  for each row execute function public.guard_third_party_delivery_request();

create or replace function public.accept_third_party_delivery(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  request_row public.third_party_delivery_requests;
  vendor_for_user uuid;
begin
  if auth.uid() is null or public.current_app_role() <> 'vendor' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  select vendor_id into vendor_for_user from public.profiles where id = auth.uid();
  select r.* into request_row
  from public.third_party_delivery_requests r
  join public.orders o on o.id = r.order_id
  where r.order_id = p_order_id and r.vendor_id = vendor_for_user
    and o.vendor_id = vendor_for_user and o.fulfilment_mode = 'third_party_delivery'
  for update of r;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if request_row.status = 'accepted' then
    return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'accepted');
  end if;
  if request_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;
  if not exists (
    select 1 from public.payments p
    where p.order_id = p_order_id and lower(p.status) in ('paid', 'captured', 'success', 'succeeded')
  ) then return jsonb_build_object('ok', false, 'error', 'payment_required'); end if;
  update public.third_party_delivery_requests
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where order_id = p_order_id;
  return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'accepted');
end;
$$;

create or replace function public.issue_third_party_delivery_code(
  p_order_id uuid, p_code_hash text, p_code_expires_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  request_row public.third_party_delivery_requests;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  select r.* into request_row
  from public.third_party_delivery_requests r
  where r.order_id = p_order_id and r.customer_id = auth.uid()
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if request_row.status not in ('accepted', 'expired') then return jsonb_build_object('ok', false, 'error', 'not_accepted'); end if;
  if request_row.failed_attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'attempt_limit'); end if;
  if request_row.code_issued_count >= 5 then return jsonb_build_object('ok', false, 'error', 'issue_limit'); end if;
  if p_code_hash is null or p_code_expires_at is null
     or p_code_hash !~ '^[a-fA-F0-9]{64}$'
     or p_code_expires_at <= now()
     or p_code_expires_at > now() + interval '30 minutes' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code_request');
  end if;
  update public.third_party_delivery_requests
  set status = 'accepted', code_hash = lower(p_code_hash), code_expires_at = p_code_expires_at,
      code_issued_count = code_issued_count + 1, updated_at = now()
  where order_id = p_order_id;
  return jsonb_build_object(
    'ok', true, 'status', 'accepted', 'code_expires_at', p_code_expires_at,
    'code_issued_count', request_row.code_issued_count + 1
  );
end;
$$;

create or replace function public.verify_third_party_delivery_code(p_order_id uuid, p_code_hash text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  request_row public.third_party_delivery_requests;
  vendor_for_user uuid;
  next_attempt integer;
begin
  if auth.uid() is null or public.current_app_role() <> 'vendor' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  select vendor_id into vendor_for_user from public.profiles where id = auth.uid();
  select r.* into request_row
  from public.third_party_delivery_requests r
  join public.orders o on o.id = r.order_id
  where r.order_id = p_order_id and r.vendor_id = vendor_for_user
    and o.vendor_id = vendor_for_user and o.fulfilment_mode = 'third_party_delivery'
  for update of r;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if request_row.status = 'delivered' then return jsonb_build_object('ok', false, 'error', 'already_delivered'); end if;
  if request_row.status = 'locked' or request_row.failed_attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'attempt_limit');
  end if;
  if request_row.status <> 'accepted' or request_row.code_hash is null then
    return jsonb_build_object('ok', false, 'error', 'code_not_issued');
  end if;
  if request_row.code_expires_at is null or request_row.code_expires_at <= now() then
    update public.third_party_delivery_requests
    set status = 'expired', code_hash = null, code_expires_at = null, updated_at = now()
    where order_id = p_order_id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if p_code_hash is null or p_code_hash !~ '^[a-fA-F0-9]{64}$'
     or lower(p_code_hash) <> request_row.code_hash then
    next_attempt := request_row.failed_attempts + 1;
    update public.third_party_delivery_requests
    set failed_attempts = next_attempt,
        status = case when next_attempt >= 5 then 'locked' else status end,
        updated_at = now()
    where order_id = p_order_id;
    return jsonb_build_object(
      'ok', false, 'error', case when next_attempt >= 5 then 'attempt_limit' else 'invalid_code' end,
      'remaining_attempts', greatest(0, 5 - next_attempt)
    );
  end if;
  update public.third_party_delivery_requests
  set status = 'delivered', delivered_at = now(), code_hash = null,
      code_expires_at = null, updated_at = now()
  where order_id = p_order_id;
  update public.orders set status = 'delivered', updated_at = now()
  where id = p_order_id and fulfilment_mode = 'third_party_delivery';
  return jsonb_build_object('ok', true, 'status', 'delivered');
end;
$$;

revoke all on function public.accept_third_party_delivery(uuid) from public, anon;
revoke all on function public.issue_third_party_delivery_code(uuid, text, timestamptz) from public, anon;
revoke all on function public.verify_third_party_delivery_code(uuid, text) from public, anon;
grant execute on function public.accept_third_party_delivery(uuid) to authenticated;
grant execute on function public.issue_third_party_delivery_code(uuid, text, timestamptz) to authenticated;
grant execute on function public.verify_third_party_delivery_code(uuid, text) to authenticated;

create or replace function public.guard_third_party_delivery_completion()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.fulfilment_mode = 'third_party_delivery' and new.status = 'completed' then
    raise exception 'Third-party orders must use the delivered status after handover verification';
  end if;
  if new.status = 'delivered' and (
     new.fulfilment_mode <> 'third_party_delivery'
     or not exists (
       select 1 from public.third_party_delivery_requests r
       where r.order_id = old.id and r.status = 'delivered' and r.delivered_at is not null
     )) then
    raise exception 'Third-party delivery must be verified before an order is delivered';
  end if;
  return new;
end;
$$;

create or replace function public.guard_order_financials() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.current_app_role() in ('vendor','operations') then
    new.order_number:=old.order_number;
    new.requirement_id:=old.requirement_id;
    new.quote_id:=old.quote_id;
    new.customer_id:=old.customer_id;
    new.vendor_id:=old.vendor_id;
    new.vendor_base_total:=old.vendor_base_total;
    new.markup_total:=old.markup_total;
    new.tax_amount:=old.tax_amount;
    new.delivery_fee:=old.delivery_fee;
    new.customer_total:=old.customer_total;
    new.fulfilment_mode:=old.fulfilment_mode;
    new.scheduled_date:=old.scheduled_date;
    new.scheduled_slot:=old.scheduled_slot;
  end if;
  if auth.uid() is not null and public.current_app_role()='vendor' then
    if new.status not in ('confirmed','preparing','ready','out_for_delivery','ready_for_pickup','completed','delivered') then
      raise exception 'Vendor order status is not permitted';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists guard_order_financials on public.orders;
create trigger guard_order_financials before update on public.orders for each row execute function public.guard_order_financials();

drop trigger if exists guard_third_party_delivery_completion on public.orders;
create trigger guard_third_party_delivery_completion
  before update of status on public.orders
  for each row execute function public.guard_third_party_delivery_completion();