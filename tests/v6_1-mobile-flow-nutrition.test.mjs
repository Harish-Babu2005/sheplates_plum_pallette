import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = fs.readFileSync(path.join(root, 'components/sheplates-v3.tsx'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'components/sheplates-entry.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'app/api/agent/route.ts'), 'utf8');
const commerce = fs.readFileSync(path.join(root, 'app/api/commerce/route.ts'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'lib/she-agent-commerce-runtime.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/V6_1_MOBILE_NUTRITION_FLOW.sql'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v6.1 mobile auth remains usable with the keyboard open', () => {
  assert.equal(pkg.version, '7.2.0');
  assert.match(entry, /sp-auth-dialog/);
  assert.match(entry, /scrollIntoView\(\{ block: "center"/);
  assert.match(entry, /autoComplete="one-time-code"/);
  assert.match(css, /\[data-slot="dialog-content"\]\.sp-auth-dialog/);
  assert.match(css, /font-size: 16px !important/);
});

test('mobile marketplace avoids button collisions and overlay nav conflicts', () => {
  assert.match(app, /k-plist/);
  assert.match(app, /k-pr-btns/);
  assert.match(fs.readFileSync(new URL('../app/shell-kit.css', import.meta.url), 'utf8'), /@media \(max-width: 640px\)[\s\S]*\.k-pr \{ grid-template-columns: 64px/);
  assert.match(app, /!notificationsOpen && <CustomerBottomNav/);
  assert.match(app, /sp-notification-sheet/);
});

test('paid orders are the source of truth for My Schedule', () => {
  assert.match(app, /const paidDeliveries = customerOrders\.filter\(\(order\) => order\.payment === "Paid"\)/);
  assert.match(app, /const syntheticSchedules/);
  assert.match(app, /const ordersByDate = new Map<string, Order\[]>/);
  assert.match(app, /onPaid=\{\(\) => navigate\(paying\?\.scheduleId \? "My schedule" : "Orders"\)\}/);
  assert.match(app, /Only paid, active schedules appear here/);
});

test('schedule totals use actual generated delivery dates', () => {
  assert.match(app, /const deliveryDates = occurrenceDatesInRange\(previewSchedule, rangeDates\)/);
  assert.match(app, /const occurrences = deliveryDates\.length/);
  assert.match(app, /total: price/);
  assert.match(app, /Confirmed delivery dates/);
});

test('nutrition is optional and unreliable estimates go to Operations', () => {
  assert.doesNotMatch(app, /nutritionReference\(/);
  assert.match(app, /Nutrition is optional/);
  assert.match(app, /notifyLiveNutritionReview/);
  assert.match(app, /nutritionSource/);
  assert.match(app, /nutritionLabelImage/);
  assert.match(agent, /nutritionAvailable=false and nutrition=null/);
  assert.match(agent, /Never silently substitute a generic food reference/);
  assert.match(commerce, /action === "notify_nutrition_review"/);
  assert.match(migration, /nutrition_status/);
  assert.match(migration, /pending_review/);
});

test('nutrition-pending products are not falsely ranked as low calorie', () => {
  assert.match(runtime, /nutrition_available/);
  assert.match(runtime, /!compact\.nutrition_available \|\| compact\.calories > maxCalories/);
  assert.match(runtime, /Number\.POSITIVE_INFINITY/);
});
