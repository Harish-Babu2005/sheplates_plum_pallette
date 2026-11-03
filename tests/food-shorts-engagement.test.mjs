import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foodShorts = await readFile(new URL("../lib/food-shorts.ts", import.meta.url), "utf8");
const shortsViewer = await readFile(new URL("../components/customer-v2/shorts.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261029000100_vendor_food_short_engagement.sql", import.meta.url), "utf8");
const viewMigration = await readFile(new URL("../supabase/migrations/20261029000200_record_food_short_views.sql", import.meta.url), "utf8");

test("vendor engagement uses the owner-only aggregate RPC instead of reading customer like rows", () => {
  const vendorRefresh = foodShorts.slice(foodShorts.indexOf('if (role === "vendor" && vendorId)'), foodShorts.indexOf("}, [mode, role, vendorId, lat, lng, vendors]);"));
  assert.match(vendorRefresh, /rpc\("vendor_food_shorts"\)/);
  assert.doesNotMatch(vendorRefresh, /food_short_likes/);
  assert.match(vendorRefresh, /setFeedError\(res\.error\.message\)/);
  assert.match(migration, /v\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /count\(\*\) FROM public\.food_short_likes/);
});

test("customer views await the recording RPC and surface failures for retry", () => {
  assert.match(foodShorts, /await sb\.rpc\("record_short_view", \{ p_short_id: id \}\)/);
  assert.match(foodShorts, /if \(res\.error\) throw new Error\(res\.error\.message\)/);
  assert.match(foodShorts, /viewedRef\.current\.delete\(id\)/);
  assert.match(shortsViewer, /void onView\(current\.id\)/);
  assert.match(viewMigration, /public\.current_app_role\(\) <> 'customer'/);
  assert.match(viewMigration, /RETURNING view_count INTO updated_view_count/);
});

test("remote customer likes persist through the authenticated likes table and report database errors", () => {
  const toggleLike = foodShorts.slice(foodShorts.indexOf("const toggleLike = useCallback"), foodShorts.indexOf("const recordView = useCallback"));
  assert.match(toggleLike, /food_short_likes"\)\.delete/);
  assert.match(toggleLike, /food_short_likes"\)\.insert/);
  assert.match(toggleLike, /if \(res\?\.error\) \{ void refresh\(\); throw new Error\(res\.error\.message\); \}/);
});
