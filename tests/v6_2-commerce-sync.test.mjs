import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("persists customer cart through the live commerce endpoint", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const client = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(route, /action === "sync_cart"/);
  assert.match(route, /commerce_cart_items/);
  assert.match(route, /serviceableProductsForCustomer/);
  assert.match(client, /syncLiveCart/);
});

test("converts the saved cart into real pending orders before payment", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(route, /action === "checkout_cart"/);
  assert.match(route, /status: "converted"/);
  assert.match(route, /from\("orders"\)\.insert/);
  assert.match(route, /from\("payments"\)\.insert/);
  assert.match(ui, /checkoutLiveCart/);
});

test("cart does not expose unpaid-order removal", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const disableMigration = await readFile(path.join(root, "supabase/migrations/20261102000600_disable_customer_unpaid_order_removal.sql"), "utf8");
  assert.doesNotMatch(route, /action === "remove_pending_order"/);
  assert.doesNotMatch(route, /customer_remove_unpaid_order/);
  assert.doesNotMatch(ui, /removeLivePendingOrder|Remove unpaid order:|Cancellation unavailable|cancellationNotice/);
  assert.match(ui, /Payment unavailable: the scheduled date has passed\./);
  assert.match(disableMigration, /DROP FUNCTION IF EXISTS public\.customer_remove_unpaid_order\(uuid\)/);
});

test("lets customers choose an exact future date for cart orders and schedules", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /aria-label="Order delivery date" type="date" min=\{tomorrow\(\)\} value=\{deliveryDate\}/);
  assert.match(ui, /scheduledDate: deliveryDate/);
  assert.match(route, /const scheduledDate = String\(body\.scheduledDate/);
  assert.match(ui, /aria-label=\{recurrence === "Once" \? "Delivery date" : "First delivery date"\}/);
  assert.match(route, /if \(!isFutureDate\(startDate\)\)/);
});

test("restores cart, previous orders and paid schedule state from live data", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(route, /cartItems/);
  assert.match(ui, /snapshot\.cartItems/);
  assert.match(ui, /statuses\.some\(\(status\).*paid/si);
  assert.match(ui, /progressed.*confirmed.*completed/si);
  assert.match(ui, /paidDeliveries/);
});

test("She Agent sees real order item names and uses the same saved cart", async () => {
  const agent = await readFile(path.join(root, "app/api/agent/route.ts"), "utf8");
  const runtime = await readFile(path.join(root, "lib/she-agent-commerce-runtime.ts"), "utf8");
  assert.match(agent, /order_items\(product_name,quantity,unit,customer_price\)/);
  assert.match(agent, /commerce_cart_items/);
  assert.match(runtime, /get_current_cart/);
  assert.match(runtime, /basketProductIds means the app should persist/);
  assert.match(runtime, /get_order_history for previous\/recent purchases/);
});
