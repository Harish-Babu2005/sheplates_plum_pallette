import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  generateDeliveryVerificationCode,
  hashDeliveryVerificationCode,
  verifyDeliveryVerificationCode,
} from "../lib/third-party-delivery.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("delivery codes are six digits and are HMAC-protected per order", () => {
  const orderId = "order-123";
  const secret = "test-only-service-secret";
  const code = generateDeliveryVerificationCode();
  assert.match(code, /^\d{6}$/);

  const hash = hashDeliveryVerificationCode(orderId, code, secret);
  assert.match(hash, /^[a-f\d]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(verifyDeliveryVerificationCode(orderId, code, hash, secret), true);
  const wrongCode = code === "999999" ? "000000" : "999999";
  assert.equal(verifyDeliveryVerificationCode(orderId, wrongCode, hash, secret), false);
  assert.equal(verifyDeliveryVerificationCode("another-order", code, hash, secret), false);
  assert.equal(verifyDeliveryVerificationCode(orderId, code, hash, "another-secret"), false);
  assert.equal(verifyDeliveryVerificationCode(orderId, "12345", hash, secret), false);
});

test("commerce API scopes request actions and never returns stored hashes", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(route, /action === "accept_third_party_delivery"[\s\S]*?profile\.role !== "vendor"/);
  assert.match(route, /action === "issue_third_party_delivery_code"[\s\S]*?profile\.role !== "customer"/);
  assert.match(route, /action === "verify_third_party_delivery_code"[\s\S]*?profile\.role !== "vendor"/);
  assert.match(route, /third_party_delivery_requests"\)\s*\.select\("order_id,customer_id,vendor_id,customer_notes,status,accepted_at,code_expires_at,code_issued_count,delivered_at,created_at,updated_at"\)/);
  assert.doesNotMatch(route, /\.select\([^)]*code_hash/);
  assert.match(route, /generateDeliveryVerificationCode\(\)/);
  assert.match(route, /hashDeliveryVerificationCode\(orderId, code, secret\)/);
  assert.match(route, /Third-party orders can only be marked delivered after the handover code is verified/);
});

test("migration enforces one-time code lifecycle and prevents direct completion bypass", async () => {
  const statusMigration = await readFile(path.join(root, "supabase/migrations/20261029000300_add_delivered_order_status.sql"), "utf8");
  const migration = await readFile(path.join(root, "supabase/migrations/20261029000400_third_party_delivery.sql"), "utf8");
  assert.match(statusMigration, /alter type public\.order_status add value if not exists 'delivered'/);
  assert.match(migration, /code_issued_count integer not null default 0 check \(code_issued_count between 0 and 5\)/);
  assert.match(migration, /failed_attempts integer not null default 0 check \(failed_attempts between 0 and 5\)/);
  assert.match(migration, /p_code_expires_at > now\(\) \+ interval '30 minutes'/);
  assert.match(migration, /request_row\.failed_attempts >= 5/);
  assert.match(migration, /if p_code_hash is null or p_code_hash !~/);
  assert.match(migration, /set status = 'delivered', delivered_at = now\(\), code_hash = null/);
  assert.match(migration, /set status = 'delivered', updated_at = now\(\)[\s\S]*?where id = p_order_id and fulfilment_mode = 'third_party_delivery'/);
  assert.match(migration, /grant select \([\s\S]*?code_issued_count, delivered_at[\s\S]*?\) on public\.third_party_delivery_requests to authenticated/);
  assert.doesNotMatch(migration.match(/grant select \([\s\S]*?\) on public\.third_party_delivery_requests to authenticated/)?.[0] || "", /code_hash|failed_attempts/);
  assert.match(migration, /guard_third_party_delivery_completion/);
});

test("customer checkout and planning expose third-party notes and vendor code verification", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const api = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(ui, /<SelectItem value="Vendor delivery">Vendor delivery<\/SelectItem>/);
  assert.match(ui, /<SelectItem value="Self pickup">Self-pickup<\/SelectItem>/);
  assert.match(ui, /<SelectItem value="Third-party delivery" disabled=\{!isLiveSupabaseMode\(\)\}>3rd Party Delivery<\/SelectItem>/);
  assert.match(ui, /Instructions for the delivery handler/);
  assert.match(ui, /Accept delivery request/);
  assert.match(ui, /Verify &amp; mark delivered|Verify & mark delivered/);
  assert.match(ui, /issueLiveThirdPartyDeliveryCode/);
  assert.match(api, /fulfilmentMode === "third_party_delivery" && requestedRecurrence !== "once"/);
  assert.match(api, /customer_notes: customerNotes/);
});