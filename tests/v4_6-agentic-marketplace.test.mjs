import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
const agent = fs.readFileSync(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
const supabase = fs.readFileSync(new URL("../lib/supabase.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/V4_6_AGENTIC_COMMERCE.sql", import.meta.url), "utf8");
const imageRoute = fs.readFileSync(new URL("../app/api/image-enhance/route.ts", import.meta.url), "utf8");

test("customer marketplace is clean, searchable and recommendation-first", () => {
  assert.match(app, /role === "customer" \? <><main/);
  assert.match(app, /Planning period/);
  assert.match(app, /Max calories \/ pack/);
  assert.match(app, /Min protein/);
  assert.match(app, /My quotations/);
  assert.match(app, /Ask She Agent to refine/);
  assert.match(app, /recommendationPopupEnabled/);
});

test("She Agent is database-grounded with controlled durable memory", () => {
  assert.match(agent, /marketplace_menu_nearby/);
  assert.match(agent, /customer_ai_memory/);
  assert.match(agent, /Never invent a product, vendor, price, availability, nutrition value, order state, product ID/);
  assert.match(app, /Clear learned memory/);
  assert.match(supabase, /clearLiveCustomerMemory/);
  assert.match(migration, /customer_ai_memory_self_delete/);
});

test("super admin has merchandising and AI-assisted campaign controls", () => {
  assert.match(app, /Homepage & campaigns/);
  assert.match(app, /AI suggest campaigns/);
  assert.match(app, /Create campaign/);
  assert.match(agent, /campaign_strategy/);
  assert.match(migration, /marketing_campaigns/);
});

test("vendor portfolio includes AI insights and truthful image enhancement", () => {
  assert.match(app, /vendor: \["Dashboard", "AI insights"/);
  assert.match(app, /Store intelligence/);
  assert.match(app, /AI enhance for marketplace/);
  assert.match(imageRoute, /gpt-image-2/);
  assert.match(imageRoute, /Preserve the actual product identity, pack, ingredients and visible quantity/);
  assert.match(supabase, /uploadLiveProductImage/);
  assert.match(migration, /product-images/);
});
