import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("customer commerce snapshots include assignments and staff scoped to that customer's orders", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(route, /else if \(role === "customer" && orders\.data\?\.length\)/);
  assert.match(route, /customerOrderIds = orders\.data\.map/);
  assert.match(route, /from\("delivery_assignments"\)[\s\S]*?\.in\("order_id", customerOrderIds\)/);
  assert.match(route, /const assignedStaffIds = \[\.\.\.new Set\(assignments\.map/);
  assert.match(route, /from\("vendor_delivery_staff"\)[\s\S]*?\.in\("id", assignedStaffIds\)/);
  assert.match(route, /return \{ orders: orders\.data \|\| \[\], schedules: schedules\.data \|\| \[\], staff, assignments/);
});

test("vendor assignment writes remain persisted and both order views resolve the assigned person", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(route, /action === "assign_staff"/);
  assert.match(route, /from\("delivery_assignments"\)\.insert\(\{ order_id: orderId, vendor_id: order\.vendor_id, delivery_staff_id: staffId/);
  assert.match(ui, /snapshot\.staff \|\| \[\]\)\.map/);
  assert.match(ui, /snapshot\.assignments \|\| \[\]\)\.map/);
  assert.match(ui, /const assignment = state\.assignments\.find\(\(x\) => x\.orderId === order\.id\)/);
  assert.match(ui, /const person = state\.staff\.find\(\(x\) => x\.id === assignment\?\.staffId\)/);
  assert.match(ui, /\["Delivery person", person \? <Fragment key="delivery-person">[\s\S]*?\{person\.phone\}[\s\S]*?: "Not assigned"\]/);
});

test("vendor order details use aligned responsive cards with consistent field typography", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /function OrderDetail[\s\S]*?h-full min-h-20 min-w-0 flex-col items-start gap-2 rounded-2xl/);
  assert.match(ui, /text-\[11px\] font-black uppercase tracking-wide text-stone-500/);
  assert.match(ui, /\["Delivery", <Fragment key="delivery">[\s\S]*?\["Items", <span className="font-bold" key="items">\{order\.quantity\} \u00d7 \{product\?\.name \|\| order\.description\}<\/span>\]/);
  assert.match(ui, /details\.map\(\(\[label, value\]\) => <OrderDetail key=\{label\} label=\{label\} value=\{value\} \/>/);
  assert.match(ui, /<div className="flex flex-col gap-4">[\s\S]*?grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-5/);
  assert.match(ui, /className="mt-1 block break-all text-xs font-semibold text-stone-600"/);
});
