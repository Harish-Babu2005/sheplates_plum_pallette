import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261027000500_p0_vendor_lifecycle.sql", import.meta.url),
  "utf8",
);
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const followupMigration = await readFile(
  new URL("../supabase/migrations/20261102000100_p0_taster_and_shop_images.sql", import.meta.url),
  "utf8",
);
const api = await readFile(new URL("../app/api/p0/vendors/route.ts", import.meta.url), "utf8");
const management = await readFile(new URL("../components/p0-vendor-management.tsx", import.meta.url), "utf8");
const completionApi = await readFile(new URL("../app/api/p0/upgrade/complete/route.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
const discover = await readFile(new URL("../components/customer-v2/discover.tsx", import.meta.url), "utf8");

function functionBody(source, name) {
  const declarations = [
    source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`),
    source.indexOf(`CREATE FUNCTION public.${name}`),
  ].filter((index) => index >= 0);
  const start = declarations.length ? Math.min(...declarations) : -1;
  assert.notEqual(start, -1, `migration defines ${name}`);
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, `${name} function body is terminated`);
  return source.slice(start, end);
}

test("P0 is a separate vendor kind and existing vendors remain subscriptions by default", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vendor_kind text NOT NULL DEFAULT 'subscription'/i);
  assert.match(schema, /vendor_kind text not null default 'subscription'/i);
  assert.match(migration, /vendor_kind='p0_connect' AND owner_id IS NULL AND plan_id IS NULL/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.vendors\s+SET\s+vendor_kind/i);
});

test("P0 creation creates a pending, inactive, hidden record with contact and operating duration", () => {
  const body = functionBody(migration, "p0_create_vendor");
  assert.match(body, /INSERT INTO public\.vendors/i);
  assert.match(body, /NULL,NULL,'p0_connect'/i);
  assert.match(body, /'submitted','inactive',false,false,p_whatsapp_number/i);
  assert.match(body, /jsonb_build_object\('duration_hours',duration_hours\)/i);
  assert.match(body, /duration_hours NOT BETWEEN 1 AND 24/i);
  assert.match(api, /p_operating_hours:\s*\{\s*duration_hours:\s*durationHours\s*\}/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.p0_create_vendor\(uuid,text,text,text,text,text,double precision,double precision,numeric,text,text,text,boolean,text,jsonb\)/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.p0_create_vendor\(uuid,text,text,text,text,text,double precision,double precision,numeric,text,text,text,boolean,text,jsonb\)/i);
  assert.match(api, /typeof error === "object" && error !== null && "message" in error/);
});

test("P0 review checks independent authorization, creator separation, coordinates, WhatsApp, and conditional FSSAI", () => {
  const body = functionBody(migration, "review_vendor_and_notify");
  assert.match(body, /public\.p0_actor_can\(actor,'review'\)/i);
  assert.match(body, /creator=actor/i);
  assert.match(body, /v\.latitude BETWEEN -90 AND 90/i);
  assert.match(body, /v\.longitude BETWEEN -180 AND 180/i);
  assert.match(body, /v\.p0_fssai_required/i);
  assert.match(body, /connect_enabled=\(vendor_kind_value='p0_connect' AND verified\)/i);
});

test("P0 cancellation hides the same record and revokes pending application invitations", () => {
  const body = functionBody(migration, "p0_cancel_vendor");
  assert.match(body, /operational_status='inactive',marketplace_visible=false,p0_cancelled_at=now\(\)/i);
  assert.match(body, /status='revoked'/i);
  assert.match(body, /'p0_vendor_cancelled'/i);
  assert.match(api, /action === "cancel" \|\| action === "reactivate"/);
  assert.match(api, /p0_cancel_vendor/);
});

test("P0 upgrade checks invitation identity and state, then updates one vendor row", () => {
  const body = functionBody(migration, "p0_complete_upgrade");
  for (const predicate of [
    /invitation\.expires_at<=now\(\)/i,
    /lower\(invitation\.invited_email\)<>lower\(invitee_email\)/i,
    /invitation\.provider_user_id IS DISTINCT FROM p_invitee/i,
    /vendor_row\.p0_cancelled_at IS NOT NULL/i,
    /vendor_row\.verification_status<>'verified'/i,
    /invitation\.plan_id/i,
  ]) assert.match(body, predicate);
  assert.match(body, /UPDATE public\.vendors\s+SET owner_id=p_invitee,plan_id=invitation\.plan_id,vendor_kind='subscription'/i);
  assert.match(body, /UPDATE public\.profiles SET vendor_id=vendor_row\.id/i);
  assert.match(body, /p0_vendor_upgraded/i);
  assert.match(completionApi, /p0_complete_upgrade/);
});

test("canceled P0 vendors cannot be discovered or contacted, and only authenticated customers can track clicks", () => {
  const discovery = functionBody(migration, "connect_vendors_nearby");
  const tracking = functionBody(migration, "track_vendor_whatsapp_click");
  assert.match(discovery, /v\.vendor_kind='p0_connect' AND v\.connect_enabled/i);
  assert.match(discovery, /v\.p0_cancelled_at IS NULL/i);
  assert.match(discovery, /d\.distance_km<=v\.service_radius_km/i);
  assert.doesNotMatch(discovery, /vendor_menu_items|store_open_today\s*=\s*true/i);
  assert.doesNotMatch(discover, /store_open_today/);
  assert.match(tracking, /public\.current_app_role\(\) IS DISTINCT FROM 'customer'::public\.app_role/i);
  assert.match(tracking, /v\.operational_status='active'/i);
  assert.match(tracking, /v\.marketplace_visible AND v\.p0_cancelled_at IS NULL/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.track_vendor_whatsapp_click\(uuid,text\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.vendor_whatsapp_click_events FROM PUBLIC,anon,authenticated/i);
});

test("marketplace product discovery excludes P0 and retains subscription catalogue filtering", () => {
  const body = functionBody(migration, "marketplace_menu_nearby");
  assert.match(body, /vendor\.vendor_kind='subscription'/i);
  assert.match(body, /item\.active AND item\.stock_quantity>0/i);
  assert.match(body, /vendor\.store_open_today/i);
  assert.match(schema, /v\.vendor_kind='subscription'/i);
});

test("P0 ownership and plan transitions cannot be made through direct client updates", () => {
  assert.match(migration, /vendor_kind='subscription'\s+AND \(owner_id=auth\.uid\(\) OR public\.current_app_role\(\) IN \('operations','admin'\)\)/i);
  assert.match(migration, /P0 ownership must be established through the authorized upgrade flow/i);
  assert.match(schema, /vendor_kind='subscription' and \(owner_id=auth\.uid\(\) or public\.current_app_role\(\) in \('operations','admin'\)\)/i);
  assert.match(schema, /REVOKE ALL ON TABLE public\.vendor_whatsapp_click_events FROM PUBLIC, anon, authenticated/i);
  assert.match(app, /role === "vendor" && !vendor && session\.p0UpgradeInvitationId/);
  assert.match(app, /<P0UpgradeAcceptance invitationId=\{session\.p0UpgradeInvitationId\}/);
});

test("Operations P0 actions require explicit permissions and upgrades are invited, not completed by sending", () => {
  assert.match(api, /profile\.role === "operations"/);
  assert.match(api, /contextValue\.permissions\[`can_\$\{action\}`\]/);
  assert.match(api, /inviteUserByEmail/);
  assert.match(api, /delivery_failed/);
  assert.match(api, /claim_pending/);
  assert.match(api, /resend\(/);
  assert.match(api, /A different upgrade invitation is already pending/);
});

test("P0 upgrades offer the Rs 499 Taster plan and the database accepts it", () => {
  const body = functionBody(followupMigration, "p0_start_upgrade_invitation");
  assert.match(management, /<option value="taster">Taster · ₹499<\/option>/);
  assert.match(body, /code IN \('taster','crave','thrive','crown'\)/i);
  assert.match(followupMigration, /p0-shop-images[\s\S]*?true[\s\S]*?10485760[\s\S]*?image\/png[\s\S]*?image\/jpeg[\s\S]*?image\/webp/i);
});

test("P0 listing creation uploads a validated shop image and stores its public URL", () => {
  assert.match(management, /request\.append\("shopImage", shopImage\)/);
  assert.match(management, /type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(api, /request\.formData\(\)/);
  assert.match(api, /p0-shop-images"\)\.upload\(imagePath, shopImage/);
  assert.match(api, /p_logo_url: logoUrl/);
  assert.match(api, /Shop image must be under 10 MB/);
});
