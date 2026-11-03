-- V9_12: vendor plans from the Vendor Partnership Agreement (Annexure A) and once-a-day Food Drops.
--
-- Plans (monthly, exclusive of GST):
--   Taster  Rs 499  business listing, catalogue, leads through WhatsApp
--   Crave   Rs 699  pre-orders, subscriptions, delivery fleet, Food Stories
--   Thrive  Rs 799  Crave + Food Drops
--   Crown   Rs 999  Thrive + Request for Quote (RFQ) with AI assistance
-- The old plans keep their ids, so every vendor stays on an equivalent plan:
--   launch -> crave, growth -> thrive, premium -> crown.
--
-- Food Drops: a drop is claimable only on the evening it is created, from 8 PM to midnight IST.
-- Vendors need the food_drops entitlement (Thrive, Crown) to publish one.
-- Safe to run more than once.

begin;

update public.vendor_plans set code = 'crave',  name = 'Crave'  where code = 'launch';
update public.vendor_plans set code = 'thrive', name = 'Thrive' where code = 'growth';
update public.vendor_plans set code = 'crown',  name = 'Crown'  where code = 'premium';

insert into public.vendor_plans(code, name, monthly_price, annual_price, entitlements)
values ('taster', 'Taster', 499, null, '{}'::jsonb)
on conflict (code) do nothing;

update public.vendor_plans set monthly_price = 499, entitlements =
  '{"catalogue":true,"inventory":true,"scheduled_orders":false,"ordering":false,"whatsapp_leads":true,"food_stories":false,"food_drops":false,"rfq_access":false,"ai_quotes":false}'::jsonb
  where code = 'taster';
update public.vendor_plans set monthly_price = 699, entitlements =
  '{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":false,"rfq_access":false,"ai_quotes":false}'::jsonb
  where code = 'crave';
update public.vendor_plans set monthly_price = 799, entitlements =
  '{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":true,"rfq_access":false,"ai_quotes":false}'::jsonb
  where code = 'thrive';
update public.vendor_plans set monthly_price = 999, entitlements =
  '{"catalogue":true,"inventory":true,"scheduled_orders":true,"ordering":true,"whatsapp_leads":false,"food_stories":true,"food_drops":true,"rfq_access":true,"ai_quotes":true,"priority_alerts":true}'::jsonb
  where code = 'crown';

-- Only vendors whose plan includes Food Drops can publish one; they can always end their own.
drop policy if exists food_drops_vendor_write on public.food_drops;
create policy food_drops_vendor_write on public.food_drops for all
  using (
    public.current_app_role() in ('operations', 'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  )
  with check (
    public.current_app_role() in ('operations', 'admin')
    or (
      exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
      and public.vendor_has_entitlement(vendor_id, 'food_drops')
    )
  );

-- A new drop opens at 8 PM IST (or now, if it is created after 8 PM) and closes at midnight IST the same day.
create or replace function public.set_food_drop_daily_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_local_now timestamp without time zone := now() at time zone 'Asia/Kolkata';
  v_local_open timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '20 hours';
  v_local_close timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day';
begin
  if v_local_now >= v_local_open then
    new.starts_at := now();
  else
    new.starts_at := v_local_open at time zone 'Asia/Kolkata';
  end if;
  new.ends_at := v_local_close at time zone 'Asia/Kolkata';
  return new;
end;
$$;

drop trigger if exists food_drops_daily_window on public.food_drops;
create trigger food_drops_daily_window
before insert on public.food_drops
for each row execute function public.set_food_drop_daily_window();

create or replace function public.claim_food_drop(p_drop_id uuid, p_quantity int)
returns public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  update public.food_drops
    set remaining_quantity = remaining_quantity - p_quantity, updated_at = now()
    where id = p_drop_id
      and status = 'active'
      and clock_timestamp() >= starts_at
      and clock_timestamp() < ends_at
      and remaining_quantity >= p_quantity
    returning * into v_drop;

  if v_drop.id is null then
    raise exception 'Food Drops are claimable only tonight, from 8:00 PM to midnight IST, while stock lasts' using errcode = 'P0001';
  end if;

  insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
  values (p_drop_id, auth.uid(), p_quantity, v_drop.drop_price, v_drop.drop_price * p_quantity)
  returning * into v_claim;

  return v_claim;
end;
$$;

grant execute on function public.claim_food_drop(uuid, int) to authenticated;

commit;
