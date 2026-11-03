-- ShePlates V4.8 — role-scoped assistant hardening
-- Run after schema.sql, V3_UPGRADE.sql, V4_UPGRADE.sql, V4_2_VENDOR_PAYOUTS.sql and V4_6_AGENTIC_COMMERCE.sql.
-- The assistant endpoint separately enforces verified role scopes. These policy changes
-- reduce accidental exposure of governance-only configuration through direct client reads.

-- Marketplace merchandising remains readable to signed-in users because customers need
-- the featured-product configuration. Any future non-marketplace settings stay Admin-only.
drop policy if exists platform_settings_authenticated_read on public.platform_settings;
drop policy if exists platform_settings_scoped_read on public.platform_settings;
create policy platform_settings_scoped_read on public.platform_settings
  for select using (
    public.current_app_role() = 'admin'
    or setting_key = 'marketplace_home'
  );

-- Campaign design and targeting are Super Admin governance functions.
drop policy if exists marketing_campaigns_team_read on public.marketing_campaigns;
drop policy if exists marketing_campaigns_admin_read on public.marketing_campaigns;
create policy marketing_campaigns_admin_read on public.marketing_campaigns
  for select using (public.current_app_role() = 'admin');

-- Keep the existing Admin-only write policy from V4.6 in place.
-- Customer learned preferences remain customer-self only; no broader read policy is added.

comment on table public.customer_ai_memory is
  'Customer-specific commerce preferences. Read/write/delete is limited to the owning customer; She Agent uses this only inside that customer context.';

comment on table public.marketing_campaigns is
  'Super Admin controlled campaign drafts and active campaigns. Assistant suggestions are proposals and do not activate campaigns automatically.';
