import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const DEMO = {
  customer: { email: "customer@sheplates.demo", password: "Customer@123" },
  vendor: { email: "vendor@sheplates.demo", password: "Vendor@123" },
  operations: { email: "operations@sheplates.demo", password: "Operations@123" },
  admin: { email: "admin@sheplates.demo", password: "Admin@123" },
};

/** Signs in as a customer via the "Customer login" entry and waits for the
 * authenticated shell (or first-login onboarding) to render. Clears any
 * previous session first so tests don't depend on leftover browser state. */
export async function loginAsCustomer(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  // The header shows "Customer login" on desktop and just "Sign in" on
  // mobile (sm:hidden / hidden sm:inline), so match either.
  await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  await page.getByLabel("Email").fill(DEMO.customer.email);
  await page.locator('input[type="password"]').fill(DEMO.customer.password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForSelector('text=Loading your ShePlates profile', { state: "hidden", timeout: 15_000 }).catch(() => { });
}

export async function loginAsStaff(page: Page, who: "vendor" | "operations" | "admin") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  // "Vendor / Team" on desktop, just "Vendor" on mobile.
  await page.getByRole("button", { name: /Vendor/ }).click();
  await page.getByLabel("Email").fill(DEMO[who].email);
  await page.locator('input[type="password"]').fill(DEMO[who].password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForSelector('text=Loading your ShePlates profile', { state: "hidden", timeout: 15_000 }).catch(() => { });
}

/** Signs out via the in-app button (does NOT clear localStorage) and signs
 * back in as a different demo role — for tests that follow one piece of data
 * (an RFQ, a ticket, a transaction) across roles. The mock local-state blob
 * (`sheplates-v3-state`) is shared across all roles in one browser, so this
 * is how a customer-created RFQ becomes visible to a vendor/operations login
 * in the same test. loginAsCustomer/loginAsStaff would wipe that blob. */
export async function switchTo(page: Page, who: "customer" | "vendor" | "operations" | "admin") {
  const signOut = page.getByRole("button", { name: "Sign out" });
  // Staff headers show "Sign out" directly; the customer header hides it
  // inside the account dropdown/sheet, which must be opened first.
  if (!(await signOut.isVisible().catch(() => false))) {
    await page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first().click();
  }
  await signOut.click();
  // Confirm the (async) sign-out actually completed before doing anything
  // else — otherwise the next click can race a still-authenticated page that
  // hasn't torn down its dashboard yet, landing nowhere useful.
  await page.getByText("Signed out").waitFor({ state: "visible", timeout: 8000 }).catch(() => { });
  // On narrow viewports a stack of toasts accumulated during the test so far
  // (this test's own "Signed out", "Payment successful", etc.) renders full-
  // width right over the header's login buttons. Even a forced click still
  // does a real hit-test at the button's on-screen coordinates, so whichever
  // toast is topmost there eats the click instead — remove the toasts
  // outright rather than fight z-order/timing. Sonner re-renders its own
  // list from React state on the next toast, so removing these DOM nodes
  // has no lasting effect beyond clearing the current visual stack.
  await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove()));
  const loginButtonName = who === "customer" ? /^Customer login$|^Sign in$/ : /^Vendor(\s*\/\s*Team)?$/;
  // Anchored: an unanchored /Vendor/ also matches staff sidebar nav items
  // ("Vendor onboarding", "Vendor payments", ...) that can still be present
  // in the DOM for a moment during the sign-out transition.
  const emailField = page.getByLabel("Email");
  let opened = false;
  for (let attempt = 0; attempt < 3 && !opened; attempt++) {
    await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove()));
    await page.getByRole("button", { name: loginButtonName }).click({ force: true });
    // Occasionally (seen under full-suite load, more on mobile) this click
    // still lands during the sign-out transition and never actually opens
    // the dialog — self-heal by retrying rather than hanging the whole test.
    opened = await emailField.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!opened) throw new Error(`switchTo(${who}): login dialog never opened after 3 attempts`);
  await emailField.fill(DEMO[who].email);
  await page.locator('input[type="password"]').fill(DEMO[who].password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForSelector('text=Loading your ShePlates profile', { state: "hidden", timeout: 15_000 }).catch(() => { });
  // Confirm the session is fully established and rendered before reloading —
  // reloading too early can race the Supabase auth write and sign back out.
  if (who === "customer") {
    await page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first().waitFor({ timeout: 15_000 });
  } else {
    await page.getByRole("button", { name: "Sign out" }).waitFor({ timeout: 15_000 });
  }
  // A same-page sign-out/sign-in (no full navigation) leaves the mobile
  // responsive shell — the hamburger drawer in particular — uninitialized on
  // some viewports. A reload is harmless (the Supabase session and the shared
  // local mock-state blob both live in storage that survives it) and matches
  // what a real user gets after any browser refresh.
  await page.reload();
  await page.waitForSelector('text=Loading your ShePlates profile', { state: "hidden", timeout: 15_000 }).catch(() => { });
}

/** Opens the staff sidebar drawer if it's currently a closed hamburger menu
 * (narrow viewports only — on desktop the sidebar is always visible and this
 * button is a harmless no-op toggle). */
export async function openStaffNavIfCollapsed(page: Page) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  try {
    // An instant isVisible() check can race a just-completed navigation or
    // reload before the responsive shell finishes settling — wait briefly
    // instead. On desktop the toggle never exists, so this just times out
    // quickly and falls through as the harmless no-op it always was.
    await toggle.waitFor({ state: "visible", timeout: 1500 });
    await toggle.click();
  } catch {
    // Desktop, or the sidebar was already open — nothing to do.
  }
}

/** Resets the product tour's completion state for a demo account directly in
 * the database (profiles.tours_completed), so tour specs get a deterministic
 * "first login" every run instead of depending on whether some earlier run
 * (or manual testing) already dismissed it for that account. Requires
 * SUPABASE_SERVICE_ROLE_KEY — the same env this whole app already needs. */
export async function resetTourCompletion(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: user } = await admin.auth.admin.listUsers();
  const match = user?.users.find((u) => u.email === email);
  if (!match) return;
  await admin.from("profiles").update({ tours_completed: [] }).eq("id", match.id);
}

/** Dismisses the product tour if it auto-opened (it fires ~900ms after
 * login), so a test can interact with the underlying page without the
 * coach-mark overlay intercepting clicks. */
export async function dismissTourIfOpen(page: Page) {
  // Scoped to the tour dialog with an exact name: a bare /Skip/ also matches
  // the taste-setup dialog's "Skip taste setup" button and throws a strict-mode
  // violation that would silently leave the tour overlay up.
  const tour = page.getByRole("dialog", { name: "Product tour" });
  const skip = tour.getByRole("button", { name: "Skip", exact: true });
  try {
    await skip.waitFor({ state: "visible", timeout: 12_000 });
    await skip.click();
    await tour.waitFor({ state: "hidden", timeout: 5000 });
  } catch {
    // Tour never appeared (already dismissed for this user) — nothing to do.
  }
}
