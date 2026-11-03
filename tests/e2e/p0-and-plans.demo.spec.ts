import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

// P0 Connect menu entries, the four vendor plans, plan-gated Food Drops and the removal of customer cancellation.
// Demo mode (no database): each test seeds its own state and session. The P0 screen itself needs a live account,
// so only its entry point is checked here; the database side is covered by scripts/verify-p0-live.mjs.

const SESSIONS = {
  admin: { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] },
  operations: { email: "operations@sheplates.demo", name: "Ops", role: "operations", toursCompleted: ["operations_v1"] },
  vendor: { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] },
  customer: { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] },
};

async function openAs(page: Page, who: keyof typeof SESSIONS, tweak?: (state: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState();
  tweak?.(state);
  await page.addInitScript(([s, u]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
      localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
      sessionStorage.setItem("seeded", "1");
    }
  }, [state, SESSIONS[who]] as const);
  await page.goto("/");
}

test("Operations and Super Admin both have a P0 Connect vendors screen in the menu", async ({ page }) => {
  for (const who of ["operations", "admin"] as const) {
    await page.goto("/");
    await page.evaluate(() => sessionStorage.removeItem("seeded"));
    await openAs(page, who);
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    const entry = page.getByRole("button", { name: "P0 Connect vendors" }).first();
    await expect(entry).toBeVisible({ timeout: 60_000 });
    await entry.click();
    await expect(page.getByText(/P0 Connect|Create P0 vendor|P0 vendor/i).first()).toBeVisible({ timeout: 10_000 });
  }
});

test("Super Admin can open the Operations Orders profile", async ({ page }) => {
  await openAs(page, "admin");
  await dismissTourIfOpen(page);
  await openStaffNavIfCollapsed(page);
  const ordersEntry = page.getByRole("button", { name: "Orders", exact: true }).first();
  await expect(ordersEntry).toBeVisible({ timeout: 60_000 });
  await ordersEntry.click();
  await expect(page.getByRole("heading", { name: "Platform order control" })).toBeVisible();
  await expect(page.getByText("Orders in view")).toBeVisible();
});

test("vendors are not offered a P0 menu or a made-up 'Vendor workspace' entry", async ({ page }) => {
  await openAs(page, "vendor");
  await dismissTourIfOpen(page);
  await expect(page.getByRole("button", { name: "Catalog" }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "P0 Connect vendors" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Vendor workspace" })).toHaveCount(0);
});

test("Super Admin sees the four plans with Annexure A prices", async ({ page }) => {
  await openAs(page, "admin");
  await dismissTourIfOpen(page);
  await openStaffNavIfCollapsed(page);
  await page.getByRole("button", { name: "Vendor plans" }).first().click({ timeout: 60_000 });
  for (const [name, price] of [["Taster", "499"], ["Crave", "699"], ["Thrive", "799"], ["Crown", "999"]]) {
    const card = page.locator("h3", { hasText: new RegExp(`^${name}$`) }).first().locator("xpath=ancestor::div[contains(@class,'surface-card')][1]");
    await expect(card).toContainText(price);
  }
});

test("a vendor on the Crave plan is told Food Drops need Thrive or Crown; a Thrive vendor can create one", async ({ page }) => {
  await openAs(page, "vendor", (s) => { for (const v of s.vendors as { id: string; plan: string }[]) if (v.id === "v-meena") v.plan = "Crave"; });
  await dismissTourIfOpen(page);
  await page.getByRole("button", { name: "Food Drops" }).first().click({ timeout: 60_000 });
  await expect(page.getByText("Food Drops are on the Thrive and Crown plans")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /New drop/ })).toHaveCount(0);
});

test("a Thrive vendor sees the Food Drops screen with the one-evening rule", async ({ page }) => {
  await openAs(page, "vendor", (s) => { for (const v of s.vendors as { id: string; plan: string }[]) if (v.id === "v-meena") v.plan = "Thrive"; });
  await dismissTourIfOpen(page);
  await page.getByRole("button", { name: "Food Drops" }).first().click({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /New drop/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/available only on the evening it is created/)).toBeVisible();
});

test("customers have no Cancel button on orders or schedules", async ({ page }) => {
  await openAs(page, "customer");
  await dismissTourIfOpen(page);
  await expect(page.getByRole("button", { name: "Stories", exact: true })).toBeVisible({ timeout: 60_000 });
  for (const name of (page.viewportSize()?.width ?? 1280) < 768 ? ["Orders", "Profile"] : ["Orders", "Schedules"]) {
    await page.getByRole("button", { name, exact: true }).first().click({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Cancel( order| schedule)?$/ })).toHaveCount(0);
  }
});
