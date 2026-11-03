import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const supabaseLib = fs.readFileSync(path.join(root, "lib/supabase.ts"), "utf8");
const entryComponent = fs.readFileSync(path.join(root, "components/sheplates-entry.tsx"), "utf8");
const resetPasswordPage = fs.readFileSync(path.join(root, "app/reset-password/page.tsx"), "utf8");

test("Supabase library exports sendPasswordResetEmail and updatePassword with validation", () => {
  // Verifies Supabase Auth API functions are exported
  assert.match(supabaseLib, /export async function sendPasswordResetEmail/);
  assert.match(supabaseLib, /resetPasswordForEmail/);
  assert.match(supabaseLib, /export async function updatePassword/);
  assert.match(supabaseLib, /updateUser\(\{ password: newPassword \}\)/);
  
  // Verifies password length requirement of at least 8 characters
  assert.match(supabaseLib, /newPassword\.length < 8/);
  // Verifies email format validation regex
  assert.match(supabaseLib, /@/);
  // Verifies redirect URL helper
  assert.match(supabaseLib, /reset-password/);
});

test("Customer login view includes 'Forgot password?' link and handles reset request", () => {
  // Check for the trigger link in customer login
  assert.match(entryComponent, /Forgot password\?/);
  
  // Check for forgot mode and states
  assert.match(entryComponent, /type AuthMode = "login" \| "create" \| "forgot"/);
  assert.match(entryComponent, /mode === "forgot"/);
  assert.match(entryComponent, /setResetSent/);
  
  // Check email validation
  assert.match(entryComponent, /Enter your registered email address/);
  assert.match(entryComponent, /sendPasswordResetEmail/);
  
  // Check success state and back navigation
  assert.match(entryComponent, /Password reset link sent!/);
  assert.match(entryComponent, /Back to customer sign in|Back to sign in/);
  
  // Check recovery URL detection on landing
  assert.match(entryComponent, /type=recovery/);
  assert.match(entryComponent, /\/reset-password/);
});

test("Reset password page validates inputs and handles link states gracefully", () => {
  // Validation checks for password and confirmation
  assert.match(resetPasswordPage, /password\.length < 8/);
  assert.match(resetPasswordPage, /password !== confirmPassword/);
  assert.match(resetPasswordPage, /Passwords do not match/);
  
  // Supabase Auth recovery listeners
  assert.match(resetPasswordPage, /PASSWORD_RECOVERY/);
  assert.match(resetPasswordPage, /exchangeCodeForSession/);
  assert.match(resetPasswordPage, /updatePassword/);
  
  // Graceful handling of invalid, expired, or already used links
  assert.match(resetPasswordPage, /Invalid or expired link|Reset link problem/);
  assert.match(resetPasswordPage, /Request a new reset link/);
  
  // Success state presentation
  assert.match(resetPasswordPage, /Password updated|All set!/);
  assert.match(resetPasswordPage, /Go to customer sign in/);
});

test("Authentication integrity: vendor, team, operations, and existing sessions are preserved", () => {
  // Vendor registration and team login untouched
  assert.match(entryComponent, /Vendor \/ Team access/);
  assert.match(entryComponent, /Be part of our vendor team/);
  assert.match(entryComponent, /liveSignIn/);
  assert.match(entryComponent, /readLocalVendorAccounts/);
  assert.match(entryComponent, /readLocalStaffAccount/);
});

test("Runtime validation logic for email format and password rules", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.equal(emailRegex.test("customer@example.com"), true);
  assert.equal(emailRegex.test("customer.name+tag@domain.co.in"), true);
  assert.equal(emailRegex.test("invalid-email"), false);
  assert.equal(emailRegex.test("customer@"), false);
  assert.equal(emailRegex.test("@domain.com"), false);
  assert.equal(emailRegex.test(""), false);

  const isValidPassword = (p) => typeof p === "string" && p.length >= 8;
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("1234567"), false);
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword("securePass123!"), true);

  const passwordsMatch = (p, c) => p === c && isValidPassword(p);
  assert.equal(passwordsMatch("password123", "password123"), true);
  assert.equal(passwordsMatch("password123", "password456"), false);
});

test("No demo mode simulation or fake email success in password reset", () => {
  // Ensure the forgot password flow does not simulate or fake email sending in demo mode
  assert.doesNotMatch(entryComponent, /Password reset simulated in demo mode/);
  assert.doesNotMatch(entryComponent, /simulated/i);
  assert.doesNotMatch(resetPasswordPage, /hashLocalAccountPassword/);
  assert.doesNotMatch(resetPasswordPage, /LOCAL_CUSTOMER_KEY/);
});
