import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("vendor profile / verification view defines the three vendor plans with features and pricing", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /const THREE_VENDOR_PLANS = \[/);
  assert.match(ui, /name: "Crave"/);
  assert.match(ui, /price: 699/);
  assert.match(ui, /name: "Thrive"/);
  assert.match(ui, /price: 799/);
  assert.match(ui, /name: "Crown"/);
  assert.match(ui, /price: 999/);
});

test("vendor profile / verification view displays Subscription plans section with upgrade options", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /<h3 className="text-xl font-black">Subscription plans<\/h3>/);
  assert.match(ui, /Active: \{vendor\.plan\}/);
  assert.match(ui, /Upgrade to \{plan\.name\}/);
  assert.match(ui, /async function upgradePlan\(newPlan: Vendor\["plan"\]\)/);
  assert.match(ui, /toast\.success\(`Plan upgraded to \$\{newPlan\}!`\)/);
});

test("vendor navigation supports Profile and Vendor profile routing to VerificationView", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /if \(active === "Verification" \|\| active === "Profile" \|\| active === "Vendor profile"\) return <VerificationView/);
});

