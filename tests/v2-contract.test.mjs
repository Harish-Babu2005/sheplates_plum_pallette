import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ships the Sites Vite plugin required by local development", async () => {
  const config = await readFile(path.join(root, "vite.config.ts"), "utf8");
  const plugin = await readFile(path.join(root, "build/sites-vite-plugin.ts"), "utf8");

  assert.match(config, /\.\/build\/sites-vite-plugin/);
  assert.match(plugin, /export function sites/);
});

test("ships all five role-testing identities", async () => {
  const source = await readFile(path.join(root, "lib/sheplates-v2-data.ts"), "utf8");
  for (const email of [
    "customer@sheplates.demo",
    "vendor@sheplates.demo",
    "newvendor@sheplates.demo",
    "operations@sheplates.demo",
    "admin@sheplates.demo",
  ]) {
    assert.match(source, new RegExp(email.replace(".", "\\.")));
  }
});

test("ships the public marketplace and consolidated authentication entries", async () => {
  const entry = await readFile(path.join(root, "components/sheplates-entry.tsx"), "utf8");
  assert.match(entry, /Customer login/i);
  assert.match(entry, /Vendor \/ Team/i);
  assert.match(entry, /navigator\.geolocation/i);
  assert.match(entry, /Browse kitchens/i);
  assert.match(entry, /She Agent/i);
  assert.match(entry, /Be part of our vendor team/i);
  assert.doesNotMatch(entry, /teamDemos\.map/);
  assert.doesNotMatch(entry, /Use customer demo credentials/i);
  assert.doesNotMatch(entry, /Super admin login/i);
  assert.doesNotMatch(entry, /Operations login/i);
});

test("ships V4 schedules, carts, RFQ upload, storefronts, tracking and tickets", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const upgrade = await readFile(path.join(root, "supabase/V4_UPGRADE.sql"), "utf8");
  const whatsapp = await readFile(path.join(root, "supabase/functions/send-communication-outbox/index.ts"), "utf8");

  for (const feature of [
    "SchedulesV4", "CartView", "RequirementsV4", "CustomerQuotesV4", "CustomerProfileV4",
    "StorefrontPos", "OrdersV4", "TicketCentre", "AIInsights", "Share live position",
    "Be part of our vendor team", "per selected pack", "Comparable basis",
  ]) assert.match(ui + await readFile(path.join(root, "components/sheplates-entry.tsx"), "utf8"), new RegExp(feature, "i"));

  for (const table of ["customer_addresses", "vendor_outlets", "commerce_carts", "delivery_tracking_events", "support_tickets", "communication_outbox"]) {
    assert.match(upgrade, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(upgrade, /review_vendor_and_notify/i);
  assert.match(upgrade, /tickets_scoped_read/i);
  assert.match(upgrade, /tracking_parties_read/i);
  assert.match(whatsapp, /graph\.facebook\.com/i);
});

test("includes trusted Supabase test-user provisioning", async () => {
  const script = await readFile(path.join(root, "scripts/create-supabase-users.mjs"), "utf8");
  assert.match(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(script, /auth\.admin\.createUser/);
  assert.match(script, /operations@sheplates\.demo/);
  assert.match(script, /admin@sheplates\.demo/);
});

test("ships a staff-only Supabase credential command", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const script = await readFile(path.join(root, "scripts/create-supabase-staff-users.mjs"), "utf8");

  assert.match(pkg.scripts["supabase:create-staff-users"], /create-supabase-staff-users/);
  assert.match(script, /operations@sheplates\.demo/);
  assert.match(script, /admin@sheplates\.demo/);
  assert.doesNotMatch(script, /vendor@sheplates\.demo/);
  assert.doesNotMatch(script, /customer@sheplates\.demo/);
  assert.match(script, /auth\.admin\.(createUser|updateUserById)/);
  assert.match(script, /from\("profiles"\)\.upsert/);
  assert.match(script, /Profile role verification failed/);
});

test("isolates local notifications by both identity and role", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");

  assert.match(ui, /recipientRole:\s*Role/);
  assert.match(ui, /item\.recipientRole === session\.role/);
  assert.match(ui, /item\.recipient\.toLowerCase\(\) === session\.email\.toLowerCase\(\)/);
  assert.match(ui, /Discard those ambiguous entries/);
  assert.match(ui, /notificationBelongsToSession\(item, session\)/);
});

test("surfaces staff authentication failures clearly", async () => {
  const entry = await readFile(path.join(root, "components/sheplates-entry.tsx"), "utf8");
  const auth = await readFile(path.join(root, "lib/supabase.ts"), "utf8");

  assert.match(entry, /authErrorMessage/);
  assert.doesNotMatch(entry, /supabase:create-staff-users/);
  assert.match(entry, /contact your administrator/i);
  assert.match(auth, /no ShePlates role profile/);
});

test("keeps agentic cancellation advisory and operations controlled", async () => {
  const agent = await readFile(path.join(root, "app/api/agent/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");

  assert.match(agent, /recommend/i);
  assert.match(agent, /must remain human-confirmed/i);
  assert.match(ui, /Approve & reverse/i);
  assert.match(ui, /payment reversal/i);
});

test("ships V3 scheduling, nutrition, notifications, and role-scoped agent flows", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const upgrade = await readFile(path.join(root, "supabase/V3_UPGRADE.sql"), "utf8");
  const worker = await readFile(path.join(root, "public/sw.js"), "utf8");

  assert.match(ui, /ScheduleDialog/);
  assert.match(ui, /Number of packs per delivery/);
  assert.match(ui, /Calculate for this pack/);
  assert.match(ui, /SheAgent/);
  assert.match(ui, /vendor_self/);
  assert.match(ui, /customer_self/);
  assert.match(ui, /operations_authorised/);
  assert.match(ui, /super_admin_authorised/);
  assert.match(ui, /Delivery person assigned/);
  assert.match(upgrade, /customer_preferences/);
  assert.match(upgrade, /product_schedules/);
  assert.match(upgrade, /vendor_delivery_staff/);
  assert.match(upgrade, /push_subscriptions/);
  assert.match(upgrade, /enable row level security/);
  assert.match(worker, /addEventListener\("push"/);
});

test("ships real maps, clear units, and vendor marketplace readiness gates", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const geocode = await readFile(path.join(root, "app/api/geocode/route.ts"), "utf8");
  const agent = await readFile(path.join(root, "app/api/agent/route.ts"), "utf8");
  const nutrition = await readFile(path.join(root, "lib/nutrition.ts"), "utf8");

  assert.match(ui, /components\/pin-map/);
  assert.match(ui, /Find typed address/);
  assert.match(ui, /250 ml pouch\/bottle/);
  assert.match(ui, /Use my actual GPS location/);
  assert.match(ui, /distanceKm/);
  assert.match(ui, /distance <= vendor\.radiusKm/);
  assert.match(ui, /migrateLegacyProduct/);
  assert.match(ui, /vendorPrice:\s*Math\.round\(product\.vendorPrice \* step/);
  assert.match(ui, /Customer marketplace readiness/);
  assert.match(ui, /product\.stock > 0/);
  assert.match(ui, /Assign to vendor login/);
  assert.match(geocode, /nominatim\.openstreetmap\.org/);
  assert.match(geocode, /countrycodes/);
  assert.match(agent, /nutritionLooksConsistent/);
  assert.match(agent, /measurementUnit/);
  assert.match(nutrition, /name\.includes\("milk"\)/);
  assert.match(nutrition, /calories:\s*61/);
  assert.match(nutrition, /protein:\s*3\.2/);
  assert.match(nutrition, /fat:\s*3\.3/);
  assert.match(nutrition, /macroCalories/);
});

test("includes vendor verification, pricing, quote isolation, and role RLS", async () => {
  const schema = await readFile(path.join(root, "supabase/schema.sql"), "utf8");

  for (const table of [
    "vendors",
    "vendor_documents",
    "vendor_menu_items",
    "vendor_item_markups",
    "customer_requirements",
    "vendor_quotes",
    "orders",
    "cancellation_requests",
    "payment_reversals",
  ]) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }

  assert.match(schema, /current_app_role/i);
  assert.match(schema, /owns_vendor/i);
  assert.match(schema, /marketplace_menu/i);
  assert.match(schema, /customer_quote_comparison/i);
  assert.match(schema, /guard_profile_privileges/i);
  assert.match(schema, /guard_quote_privileges/i);
  assert.match(schema, /guard_order_financials/i);
  assert.match(schema, /No direct authenticated insert policy is intentionally granted/i);
  assert.match(schema, /operations/i);
  assert.match(schema, /admin/i);
});
