import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../lib/supabase.ts", import.meta.url), "utf8");
const p0Ui = await readFile(new URL("../components/p0-vendor-management.tsx", import.meta.url), "utf8");

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `source contains ${startText}`);
  const end = source.indexOf(endText, start + startText.length);
  assert.notEqual(end, -1, `source contains ${endText}`);
  return source.slice(start, end);
}

test("subscription vendors do not receive a Connect activation or WhatsApp registration control", () => {
  const storeRadius = sourceBetween(app, "function StoreRadius(", "function VerificationView(");
  assert.doesNotMatch(storeRadius, /Connect settings|WhatsApp number|saveLiveVendorConnect/i);
  assert.doesNotMatch(app, /label="WhatsApp number"|whatsappNumber|normalizeWhatsAppNumber/);
  assert.doesNotMatch(onboarding, /export async function saveLiveVendorConnect/);
  assert.doesNotMatch(onboarding, /whatsappNumber\?: string/);
});

test("P0 management owns the WhatsApp field and defaults the requested operating duration", () => {
  assert.match(p0Ui, /whatsappNumber:\s*""/);
  assert.doesNotMatch(p0Ui, /9080195630/, "no real phone number is pre-filled");
  assert.match(p0Ui, /durationHours:\s*"7"/);
  assert.match(p0Ui, /normalizeWhatsAppNumber\(form\.whatsappNumber\)/);
  assert.match(p0Ui, /durationHours:\s*form\.durationHours/);
  assert.match(p0Ui, /Operating duration \(hours\/day\)/);
});

test("Operations and Super Admin share a separate P0 Connect management surface", () => {
  assert.match(app, /operations: \[[^\]]*"P0 Connect vendors"/);
  assert.match(app, /admin: \[[^\]]*"P0 Connect vendors"/);
  assert.equal((app.match(/<P0VendorManagement role=/g) || []).length, 2);
  assert.match(app, /vendorKind !== "p0_connect"/);
});

test("subscription plan writes remain separate from P0 capability and update only plan_id", () => {
  const savePlan = sourceBetween(onboarding, "export async function saveLiveVendorPlan", "export async function");
  assert.match(savePlan, /\.update\(\{ plan_id: plan\.data\.id/);
  assert.doesNotMatch(savePlan, /connect_enabled|vendor_kind|whatsapp_number/);
  assert.match(app, /vendor\.vendorKind !== "p0_connect"/);
});
