import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261026000400_connect_vendor_capability.sql", import.meta.url),
  "utf8",
);
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

function rpcBody(name) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  assert.notEqual(start, -1, `migration defines ${name}`);
  const end = migration.indexOf("$function$;", start);
  assert.notEqual(end, -1, `${name} function body is terminated`);
  return migration.slice(start, end);
}

test("Connect capability defaults off in both the base schema and forward migration", () => {
  assert.match(schema, /connect_enabled boolean not null default false/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS connect_enabled boolean NOT NULL DEFAULT false/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.vendors/i);
});

test("discovery applies Connect, approval, visibility, coordinate, and radius eligibility without catalogue gating", () => {
  const body = rpcBody("connect_vendors_nearby");
  for (const predicate of [
    /v\.connect_enabled\s*=\s*true/i,
    /v\.verification_status\s*=\s*'verified'/i,
    /v\.operational_status\s*=\s*'active'/i,
    /v\.marketplace_visible\s*=\s*true/i,
    /v\.latitude\s+between\s+-90\s+and\s+90/i,
    /v\.longitude\s+between\s+-180\s+and\s*180/i,
    /distance\.distance_km\s*<=\s*v\.service_radius_km/i,
  ]) {
    assert.match(body, predicate);
  }
  assert.doesNotMatch(body, /vendor_menu_items|vendor_plans|store_open_today\s*=\s*true/i);
});

test("discovery RPC is explicitly public only to anon and authenticated roles", () => {
  assert.match(
    migration,
    /REVOKE ALL\s+ON FUNCTION public\.connect_vendors_nearby\(double precision, double precision\)\s+FROM PUBLIC;/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE\s+ON FUNCTION public\.connect_vendors_nearby\(double precision, double precision\)\s+TO anon, authenticated;/i,
  );
});

test("click tracking enforces customer role and Connect vendor eligibility", () => {
  const body = rpcBody("track_vendor_whatsapp_click");
  assert.match(body, /current_customer_id\s*:=\s*auth\.uid\(\)/i);
  assert.match(body, /current_customer_id\s+IS NULL/i);
  assert.match(body, /public\.current_app_role\(\)\s+IS DISTINCT FROM 'customer'::public\.app_role/i);
  for (const predicate of [
    /v\.connect_enabled\s*=\s*true/i,
    /v\.verification_status\s*=\s*'verified'/i,
    /v\.operational_status\s*=\s*'active'/i,
    /v\.marketplace_visible\s*=\s*true/i,
    /v\.latitude\s+between\s+-90\s+and\s+90/i,
    /v\.longitude\s+between\s+-180\s+and\s*180/i,
  ]) {
    assert.match(body, predicate);
  }
});

test("analytics records remain inaccessible directly and tracking stays authenticated-only", () => {
  assert.match(
    migration,
    /REVOKE ALL\s+ON FUNCTION public\.track_vendor_whatsapp_click\(uuid, text\)\s+FROM PUBLIC, anon;/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE\s+ON FUNCTION public\.track_vendor_whatsapp_click\(uuid, text\)\s+TO authenticated;/i,
  );
  assert.match(migration, /ALTER TABLE public\.vendor_whatsapp_click_events ENABLE ROW LEVEL SECURITY;/i);
  assert.match(
    migration,
    /REVOKE ALL\s+ON TABLE public\.vendor_whatsapp_click_events\s+FROM PUBLIC, anon, authenticated;/i,
  );
});
