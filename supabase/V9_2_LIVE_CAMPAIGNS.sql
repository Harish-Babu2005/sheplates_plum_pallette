-- V9.2 — Live campaigns.
--
-- Until now a campaign was only a note for the Super Admin: nothing a customer could see.
-- This makes a campaign real. The Super Admin writes the customer-facing banner (headline,
-- subline, emoji, button), says where the button goes (a category, a vendor or a product),
-- who sees it (everyone, new customers, returning customers) and when it runs. When it is
-- Active and inside its dates it appears on the customer's Marketplace home. Views and taps
-- are counted so the Super Admin can see whether it works.
--
--   marketing_campaigns        new columns for the banner, target, audience, dates, priority, counters
--   live_campaigns()           the ONLY customer read path: active + inside its dates + audience rule
--   record_campaign_event()    counts a view or a tap on a live campaign
--
-- The audience rule is applied here, on the server, from the customer's own order history, so a
-- customer can never read a campaign meant for someone else. Customers still cannot read the
-- table; only operations and admin can (existing policies). Additive and safe to re-run.

alter table public.marketing_campaigns
  add column if not exists headline text,
  add column if not exists subline text,
  add column if not exists emoji text not null default '🎉',
  add column if not exists cta_label text not null default 'Shop now',
  add column if not exists target_type text not null default 'none',
  add column if not exists target_value text,
  add column if not exists segment text not null default 'everyone',
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists priority int not null default 0,
  add column if not exists view_count int not null default 0,
  add column if not exists click_count int not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'marketing_campaigns_target_type_check') then
    alter table public.marketing_campaigns add constraint marketing_campaigns_target_type_check check (target_type in ('none', 'category', 'vendor', 'product'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'marketing_campaigns_segment_check') then
    alter table public.marketing_campaigns add constraint marketing_campaigns_segment_check check (segment in ('everyone', 'new_customers', 'returning_customers'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'marketing_campaigns_window_check') then
    alter table public.marketing_campaigns add constraint marketing_campaigns_window_check check (starts_at is null or ends_at is null or ends_at > starts_at);
  end if;
  -- an Active campaign must have something to show customers
  if not exists (select 1 from pg_constraint where conname = 'marketing_campaigns_active_needs_headline') then
    alter table public.marketing_campaigns add constraint marketing_campaigns_active_needs_headline check (status <> 'active' or char_length(trim(coalesce(headline, ''))) > 0);
  end if;
end $$;

create index if not exists marketing_campaigns_live_idx on public.marketing_campaigns(status, priority desc, created_at desc);

-- What a customer is allowed to see right now.
create or replace function public.live_campaigns()
returns table (
  id uuid, name text, headline text, subline text, offer text, emoji text, cta_label text,
  target_type text, target_value text, ends_at timestamptz, priority int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.headline, c.subline, c.offer, c.emoji, c.cta_label, c.target_type, c.target_value, c.ends_at, c.priority
  from public.marketing_campaigns c
  where auth.uid() is not null
    and c.status = 'active'
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at > now())
    and (
      c.segment = 'everyone'
      or (c.segment = 'new_customers' and not exists (select 1 from public.orders o where o.customer_id = auth.uid() and o.status <> 'cancelled'))
      or (c.segment = 'returning_customers' and exists (select 1 from public.orders o where o.customer_id = auth.uid() and o.status <> 'cancelled'))
    )
  order by c.priority desc, c.created_at desc
  limit 6
$$;
revoke all on function public.live_campaigns() from public, anon;
grant execute on function public.live_campaigns() to authenticated;

-- Counts a view or a tap, only on a campaign that is live right now.
create or replace function public.record_campaign_event(p_campaign uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  update public.marketing_campaigns
  set view_count = view_count + (case when p_kind = 'view' then 1 else 0 end),
      click_count = click_count + (case when p_kind = 'click' then 1 else 0 end)
  where id = p_campaign and auth.uid() is not null and p_kind in ('view', 'click')
    and status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
$$;
revoke all on function public.record_campaign_event(uuid, text) from public, anon;
grant execute on function public.record_campaign_event(uuid, text) to authenticated;
