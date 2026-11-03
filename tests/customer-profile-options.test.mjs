import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const v3Code = fs.readFileSync(path.resolve(__dirname, "../components/sheplates-v3.tsx"), "utf8");
const supabaseCode = fs.readFileSync(path.resolve(__dirname, "../lib/supabase.ts"), "utf8");

test("STANDARD_DIETS, STANDARD_ALLERGIES, STANDARD_GOALS constants exist and cover core options", () => {
  assert.match(v3Code, /export const STANDARD_DIETS =/);
  assert.match(v3Code, /"No preference"/);
  assert.match(v3Code, /"Vegetarian"/);
  assert.match(v3Code, /"Vegan"/);
  assert.match(v3Code, /"Eggetarian"/);
  assert.match(v3Code, /"Non-vegetarian"/);
  assert.match(v3Code, /"Jain"/);
  assert.match(v3Code, /"Low carb"/);
  assert.match(v3Code, /"High protein"/);

  assert.match(v3Code, /export const STANDARD_ALLERGIES =/);
  assert.match(v3Code, /"Milk"/);
  assert.match(v3Code, /"Egg"/);
  assert.match(v3Code, /"Peanut"/);
  assert.match(v3Code, /"Tree nuts"/);
  assert.match(v3Code, /"Gluten"/);
  assert.match(v3Code, /"Soy"/);
  assert.match(v3Code, /"Fish"/);
  assert.match(v3Code, /"Shellfish"/);

  assert.match(v3Code, /export const STANDARD_GOALS =/);
  assert.match(v3Code, /"Balanced meals"/);
  assert.match(v3Code, /"Weight management"/);
  assert.match(v3Code, /"High protein"/);
  assert.match(v3Code, /"Low sodium"/);
  assert.match(v3Code, /"Diabetes aware"/);
  assert.match(v3Code, /"Heart friendly"/);
});

test("CustomerOnboarding persists complete profile including diet, allergies and goals", () => {
  assert.match(v3Code, /await saveLiveCustomerProfile\(\{\s*userId:\s*session\.userId,\s*address,\s*latitude,\s*longitude,\s*householdSize:\s*household,\s*diet,\s*allergies,\s*goals,\s*instructions:\s*dislikes/);
  assert.match(v3Code, /STANDARD_DIETS\.map/);
});

test("loadLiveCustomerPreference retrieves customer_preferences and profile phone", () => {
  assert.match(supabaseCode, /supabase\.from\("customer_preferences"\)\.select\("\*"\)/);
  assert.match(supabaseCode, /supabase\.from\("profiles"\)\.select\("phone,\s*full_name"\)/);
  assert.match(supabaseCode, /phone:\s*profileResult\.data\?\.phone\s*\|\|\s*""/);
});

test("Customer live sync attaches phone and addresses to state.customers", () => {
  assert.match(v3Code, /phone:\s*String\(preference\.phone\s*\|\|\s*""\)/);
  assert.match(v3Code, /addresses:\s*\[\{\s*id:\s*id\("ADR"\),\s*label:\s*"Home",/);
});

test("CustomerProfileV4 has standardized diet selection and toggleable chips for allergies and goals", () => {
  assert.match(v3Code, /function CustomerProfileV4/);
  assert.match(v3Code, /STANDARD_DIETS\.map/);
  assert.match(v3Code, /STANDARD_ALLERGIES\.map/);
  assert.match(v3Code, /STANDARD_GOALS\.map/);
  assert.match(v3Code, /toggleAllergy/);
  assert.match(v3Code, /toggleGoal/);
  assert.match(v3Code, /customAllergies/);
  assert.match(v3Code, /customGoals/);
  assert.match(v3Code, /Save profile/);
});

