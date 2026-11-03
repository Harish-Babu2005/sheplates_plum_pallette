import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("commerce API route blocks delivery status transitions for future scheduled dates", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(route, /action === "update_order_status"/);
  assert.match(route, /const deliveryStatuses = new Set\(\["preparing", "ready", "out_for_delivery", "ready_for_pickup", "completed", "delivered"\]\);/);
  assert.match(route, /if \(deliveryStatuses\.has\(nextStatus\) && order\.scheduled_date && isFutureDate\(order\.scheduled_date\)\)/);
  assert.match(route, /Delivery actions are only allowed on or after the delivery date/);
});

test("sheplates-v3 UI contains time-bound check restricting delivery actions to on or after the delivery date", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /const DELIVERY_STATUSES: Order\["status"\]\[\] = \["Preparing", "Ready", "Out for delivery", "Ready for pickup", "Completed", "Delivered"\];/);
  assert.match(ui, /if \(DELIVERY_STATUSES\.includes\(status\) && order\.date > todayISO\(\)\)/);
  assert.match(ui, /Delivery actions are only allowed on or after the delivery date/);
});

test("vendor order select dropdown disables delivery statuses for future orders", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /disabled=\{DELIVERY_STATUSES\.includes\(status as Order\["status"\]\) && order\.date > todayISO\(\)\}/);
});

test("third-party delivery handover code verification blocks future delivery dates", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /async function verifyThirdPartyCode\(order: Order\) \{ if \(order\.date > todayISO\(\)\)/);
  assert.match(ui, /Handover verification is only allowed on or after the delivery date/);
});

