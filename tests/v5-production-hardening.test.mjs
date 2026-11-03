import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../components/sheplates-v3.tsx', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../components/sheplates-entry.tsx', import.meta.url), 'utf8');
const commerce = fs.readFileSync(new URL('../app/api/commerce/route.ts', import.meta.url), 'utf8');
const imageUpload = fs.readFileSync(new URL('../app/api/product-image-upload/route.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/V5_PRODUCTION_HARDENING.sql', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('production image upload prepares missing product bucket', () => {
  assert.match(imageUpload, /createBucket\("product-images"/);
  assert.match(imageUpload, /10 \* 1024 \* 1024/);
});

test('customer schedule is server-persisted before payment and expands after payment', () => {
  assert.match(commerce, /action === "create_schedule"/);
  assert.match(commerce, /status: "pending"/);
  assert.match(commerce, /action === "mark_paid"/);
  assert.match(commerce, /scheduleDates/);
  assert.match(commerce, /schedule_prepaid/);
  assert.match(app, /Continue to payment/);
});

test('vendor delivery staff and assignment are persisted', () => {
  assert.match(commerce, /action === "save_staff"/);
  assert.match(commerce, /action === "delete_staff"/);
  assert.match(commerce, /action === "assign_staff"/);
  assert.match(app, /saveLiveDeliveryStaff/);
  assert.match(app, /assignLiveDeliveryStaff/);
});

test('mobile vendor access and light form contrast are explicit', () => {
  assert.match(entry, /Vendor \/ Team/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /max-height: calc\(100dvh - 78px\)/);
});

test('V5 migration adds outlet certification and vendor unpaid-order isolation', () => {
  assert.match(migration, /certificate_number/);
  assert.match(migration, /certificate_storage_path/);
  assert.match(migration, /exists \(\s*select 1 from public\.payments/);
  assert.match(migration, /daily_paid_order_export/);
});

test('bulk catalogue uses smart list reading but preserves human approval', () => {
  assert.match(app, /\/api\/catalogue-import/);
  assert.match(app, /Approve & publish selected catalogue/);
  assert.match(app, /\/api\/product-image-generate/);
});
