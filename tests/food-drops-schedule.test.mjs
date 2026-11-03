import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  dropDisplayStatus,
  formatCountdown,
  foodDropSchedule,
  isFoodDropPurchaseWindow,
  nextFoodDropWindow,
} from "../lib/food-drops.ts";

// 8:00 PM IST = 14:30 UTC; midnight IST = 18:30 UTC.
const drop = {
  id: "drop-1",
  vendorId: "vendor-1",
  productId: "product-1",
  title: "Evening surplus",
  dropPrice: 50,
  originalPrice: 100,
  totalQuantity: 10,
  remainingQuantity: 5,
  startsAt: "2026-10-27T14:30:00.000Z",
  endsAt: "2026-10-27T18:30:00.000Z",
  status: "active",
};

test("a drop is scheduled before 8 PM and live from 8 PM through 11:59 PM IST", () => {
  assert.equal(dropDisplayStatus(drop, new Date("2026-10-27T14:29:59.000Z")), "scheduled");
  assert.equal(dropDisplayStatus(drop, new Date("2026-10-27T14:30:00.000Z")), "live");
  assert.equal(dropDisplayStatus(drop, new Date("2026-10-27T18:29:59.000Z")), "live");
  assert.equal(isFoodDropPurchaseWindow(new Date("2026-10-27T18:29:59.000Z")), true);
});

test("a drop is claimable only on the day it was created: it has ended at midnight and does not return", () => {
  const midnight = new Date("2026-10-27T18:30:00.000Z");
  assert.equal(dropDisplayStatus(drop, midnight), "ended");
  assert.equal(isFoodDropPurchaseWindow(midnight), false);
  assert.equal(dropDisplayStatus(drop, new Date("2026-10-28T14:30:00.000Z")), "ended");
  assert.equal(dropDisplayStatus(drop, new Date("2026-10-28T16:00:00.000Z")), "ended");
});

test("sold out and cancelled drops are reported as such", () => {
  const during = new Date("2026-10-27T16:00:00.000Z");
  assert.equal(dropDisplayStatus({ ...drop, remainingQuantity: 0 }, during), "sold_out");
  assert.equal(dropDisplayStatus({ ...drop, status: "cancelled" }, during), "cancelled");
});

test("new drops open at 8 PM, or immediately when created during the window, and always close at midnight", () => {
  const beforeOpening = nextFoodDropWindow(new Date("2026-10-27T14:29:59.000Z"));
  assert.equal(beforeOpening.startsAt.toISOString(), "2026-10-27T14:30:00.000Z");
  assert.equal(beforeOpening.endsAt.toISOString(), "2026-10-27T18:30:00.000Z");

  const whileOpen = nextFoodDropWindow(new Date("2026-10-27T16:00:00.000Z"));
  assert.equal(whileOpen.startsAt.toISOString(), "2026-10-27T16:00:00.000Z");
  assert.equal(whileOpen.endsAt.toISOString(), "2026-10-27T18:30:00.000Z");
});

test("the displayed schedule is the drop's own window, never the next evening", () => {
  const schedule = foodDropSchedule(drop);
  assert.equal(schedule.startsAt.toISOString(), "2026-10-27T14:30:00.000Z");
  assert.equal(schedule.endsAt.toISOString(), "2026-10-27T18:30:00.000Z");
});

test("live countdown reports seconds and reaches zero at midnight", () => {
  const closesAt = "2026-10-27T18:30:00.000Z";
  assert.equal(formatCountdown(closesAt, new Date("2026-10-27T18:29:59.000Z")), "00:01");
  assert.equal(formatCountdown(closesAt, new Date("2026-10-27T18:30:00.000Z")), "Ended");
});

test("database enforces the same one-evening window, the plan entitlement and the atomic stock guard", () => {
  const migration = fs.readFileSync(new URL("../supabase/V9_12_PLANS_AND_DAILY_FOOD_DROPS.sql", import.meta.url), "utf8");
  assert.match(migration, /Asia\/Kolkata/);
  assert.match(migration, /interval '20 hours'/);
  assert.match(migration, /before insert on public\.food_drops/i);
  assert.match(migration, /clock_timestamp\(\) >= starts_at/);
  assert.match(migration, /clock_timestamp\(\) < ends_at/);
  assert.match(migration, /remaining_quantity >= p_quantity/);
  assert.match(migration, /vendor_has_entitlement\(vendor_id, 'food_drops'\)/);
});

test("plans match Annexure A: Taster 499, Crave 699, Thrive 799, Crown 999, with Food Drops from Thrive and RFQ on Crown only", () => {
  const migration = fs.readFileSync(new URL("../supabase/V9_12_PLANS_AND_DAILY_FOOD_DROPS.sql", import.meta.url), "utf8");
  const row = (code) => migration.match(new RegExp(`monthly_price = (\\d+), entitlements =\\s*'([^']+)'::jsonb\\s*where code = '${code}'`));
  const plans = Object.fromEntries(["taster", "crave", "thrive", "crown"].map((code) => { const m = row(code); assert.ok(m, code); return [code, { price: Number(m[1]), e: JSON.parse(m[2]) }]; }));
  assert.deepEqual(["taster", "crave", "thrive", "crown"].map((c) => plans[c].price), [499, 699, 799, 999]);
  assert.deepEqual(["taster", "crave", "thrive", "crown"].map((c) => plans[c].e.food_drops), [false, false, true, true]);
  assert.deepEqual(["taster", "crave", "thrive", "crown"].map((c) => plans[c].e.rfq_access), [false, false, false, true]);
  assert.deepEqual(["taster", "crave", "thrive", "crown"].map((c) => plans[c].e.whatsapp_leads), [true, false, false, false]);
});
