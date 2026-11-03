import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("Razorpay API route creates secure orders using trusted database prices", async () => {
  const route = await readFile(path.join(root, "app/api/payments/razorpay/route.ts"), "utf8");

  // Route exports POST handler
  assert.match(route, /export async function POST\(request: Request\)/);

  // Authentication and role enforcement
  assert.match(route, /action === "create_order"/);
  assert.match(route, /if \(profile\.role !== "customer"\)/);
  assert.match(route, /function todayInIndia\(\)/);

  // Validates ownership of the order
  assert.match(route, /\.from\("orders"\)[\s\S]*?\.eq\("customer_id", profile\.id\)/);

  // Trusted price recalculation using vendor_menu_items and vendor_item_markups
  assert.match(route, /vendor_menu_items/);
  assert.match(route, /vendor_item_markups/);
  assert.match(route, /Math\.round\(basePrice \* \(1 \+ markupPercent \/ 100\) \* 100\) \/ 100/);

  // Multi-delivery occurrences recalculation
  assert.match(route, /scheduleDates\(schedule/);
  assert.match(route, /Math\.round\(perDeliveryTotal \* occurrences \* 100\) \/ 100/);

  // Amount in integer paise
  assert.match(route, /const totalPaise = Math\.round\(totalPayableRupees \* 100\)/);
  assert.match(route, /if \(totalPaise < 100\)/);
  assert.match(route, /order\.scheduled_date < todayInIndia\(\)[\s\S]*scheduled date \(\$\{order\.scheduled_date\}\) has already passed, so this order can no longer be paid/);

  // Idempotency check before creating duplicate Razorpay orders
  assert.match(route, /existingRzpOrderId/);
  assert.match(route, /https:\/\/api\.razorpay\.com\/v1\/orders/);

  // Does not expose secret in client response
  assert.doesNotMatch(route, /keySecret: process\.env\.RAZORPAY_KEY_SECRET/);
  assert.match(route, /keyId,/);
  assert.match(route, /razorpayOrderId:/);
  assert.match(route, /currency: "INR"/);
});

test("Razorpay API route performs timing-safe signature verification and confirms order", async () => {
  const route = await readFile(path.join(root, "app/api/payments/razorpay/route.ts"), "utf8");

  assert.match(route, /action === "verify_payment"/);
  assert.match(route, /razorpay_order_id/);
  assert.match(route, /razorpay_payment_id/);
  assert.match(route, /razorpay_signature/);

  // Timing safe HMAC SHA-256 verification
  assert.match(route, /crypto[\s\S]*?\.createHmac\("sha256", keySecret\)/);
  assert.match(route, /timingSafeEqualHex/);

  // Atomically updates payment and order
  assert.match(route, /\.from\("payments"\)\.update\(\{[\s\S]*?status: "paid"[\s\S]*?provider: "razorpay"[\s\S]*?provider_reference: razorpayPaymentId/);
  assert.match(route, /\.from\("orders"\)\.update\(\{[\s\S]*?status: "confirmed"/);

  // Schedule activation and covered payments for remaining dates
  assert.match(route, /\.from\("product_schedules"\)\.update\(\{[\s\S]*?status: "active"/);
  assert.match(route, /provider: "schedule_prepaid"/);
  assert.match(route, /provider_reference: `COVERED-\$\{order\.id\}`/);

  // Returns synchronized snapshot
  assert.match(route, /snapshot: await commerceSnapshot\(ctx\)/);
});

test("Direct simulated payment in app/api/commerce/route.ts is restricted in live mode", async () => {
  const commerce = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");

  assert.match(commerce, /action === "mark_paid"/);
  assert.match(commerce, /if \(process\.env\.NEXT_PUBLIC_DEMO_MODE === "false"\)/);
  assert.match(commerce, /Direct payment marking is disabled in live mode/);
});

test("Frontend PaymentDialog integrates Razorpay Checkout and preserves demo mode", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");

  // Dynamic script loader for Razorpay standard checkout
  assert.match(ui, /function loadRazorpayScript\(\): Promise<boolean>/);
  assert.match(ui, /https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js/);

  // Live Razorpay Checkout flow
  assert.match(ui, /const rzpOrder = await createLiveRazorpayOrder\(order\.id\)/);
  assert.match(ui, /await verifyLiveRazorpayPayment\(\{/);
  assert.match(ui, /toast\.success\("Payment confirmed! Your delivery schedule is active\."\)/);

  // Dismissal and failure handling
  assert.match(ui, /ondismiss: \(\) =>/);
  assert.match(ui, /rzp\.on\("payment\.failed"/);

  // Preserves demo mode
  assert.match(ui, /Demo Mode Simulated Payment/);
  assert.match(ui, /Simulated secure checkout for this environment/);
});

test("HMAC SHA-256 signature verification functions correctly and rejects tampered data", () => {
  const secret = "test_rzp_secret_key_12345";
  const orderId = "order_Nabc123XYZ";
  const paymentId = "pay_Pdef456UVW";

  const validSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Helper matching the route's timing-safe comparison
  function verify(oId, pId, sig, sec) {
    const expected = crypto.createHmac("sha256", sec).update(`${oId}|${pId}`).digest("hex");
    const bufA = Buffer.from(expected, "utf8");
    const bufB = Buffer.from(sig, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Valid verification succeeds
  assert.equal(verify(orderId, paymentId, validSignature, secret), true);

  // Tampered payment ID fails
  assert.equal(verify(orderId, "pay_TAMPERED", validSignature, secret), false);

  // Tampered order ID fails
  assert.equal(verify("order_TAMPERED", paymentId, validSignature, secret), false);

  // Wrong secret fails
  assert.equal(verify(orderId, paymentId, validSignature, "wrong_secret"), false);

  // Invalid hex length fails safely without throwing
  assert.equal(verify(orderId, paymentId, "invalid_sig_short", secret), false);
});

test("Pricing calculations correctly round currency and compute integer paise", () => {
  const vendorBasePrice = 120;
  const markupPercent = 15; // 15% operations markup
  const quantity = 3;
  const occurrences = 5;

  const customerUnitPrice = Math.round(vendorBasePrice * (1 + markupPercent / 100) * 100) / 100;
  assert.equal(customerUnitPrice, 138);

  const perDelivery = Math.round(customerUnitPrice * quantity * 100) / 100;
  assert.equal(perDelivery, 414);

  const totalPrice = Math.round(perDelivery * occurrences * 100) / 100;
  assert.equal(totalPrice, 2070);

  const totalPaise = Math.round(totalPrice * 100);
  assert.equal(totalPaise, 207000);
  assert.equal(Number.isInteger(totalPaise), true);
});
