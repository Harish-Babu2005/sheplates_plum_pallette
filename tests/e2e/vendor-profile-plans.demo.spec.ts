import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

const VENDOR_SESSION = {
  email: "v-meena@sheplates.demo",
  name: "Meena",
  role: "vendor",
  toursCompleted: ["vendor_v1"],
};

async function openVendorProfile(page: Page, initialPlan: "Crave" | "Thrive" | "Crown" = "Crave") {
  const state = buildDemoState();
  const v = state.vendors.find((item) => item.id === "v-meena");
  if (v) v.plan = initialPlan;

  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, VENDOR_SESSION] as const);

  await page.goto("/");
}

test("vendor profile displays the 3 subscription plans with upgrade and switch options", async ({ page }) => {
  await openVendorProfile(page, "Crave");
  await dismissTourIfOpen(page);

  // Navigate to Verification (vendor profile module)
  await openStaffNavIfCollapsed(page);
  const verificationNav = page.getByRole("button", { name: "Verification" }).first();
  await expect(verificationNav).toBeVisible({ timeout: 15_000 });
  await verificationNav.click();

  // Verify Subscription plans section
  await expect(page.getByRole("heading", { name: "Subscription plans" })).toBeVisible();

  // Verify all 3 plans are rendered with prices
  const craveCard = page.locator("[data-plan-card='Crave']");
  const thriveCard = page.locator("[data-plan-card='Thrive']");
  const crownCard = page.locator("[data-plan-card='Crown']");

  await expect(craveCard).toBeVisible();
  await expect(craveCard).toContainText("699");
  await expect(craveCard.getByRole("button", { name: "Current plan" })).toBeVisible();

  await expect(thriveCard).toBeVisible();
  await expect(thriveCard).toContainText("799");
  const upgradeToThriveButton = thriveCard.getByRole("button", { name: /Upgrade to Thrive/ });
  await expect(upgradeToThriveButton).toBeVisible();

  await expect(crownCard).toBeVisible();
  await expect(crownCard).toContainText("999");
  const upgradeToCrownButton = crownCard.getByRole("button", { name: /Upgrade to Crown/ });
  await expect(upgradeToCrownButton).toBeVisible();

  // Upgrade to Thrive
  await upgradeToThriveButton.click();
  await expect(page.getByText("Plan upgraded to Thrive!")).toBeVisible();

  // Now Thrive should be current
  await expect(thriveCard.getByRole("button", { name: "Current plan" })).toBeVisible();
  await expect(page.getByText("Active: Thrive")).toBeVisible();

  // Crave should now show switch option and Crown should show upgrade
  await expect(craveCard.getByRole("button", { name: /Switch to Crave/ })).toBeVisible();
  await expect(crownCard.getByRole("button", { name: /Upgrade to Crown/ })).toBeVisible();

  // Upgrade to Crown
  await crownCard.getByRole("button", { name: /Upgrade to Crown/ }).click();
  await expect(page.getByText("Plan upgraded to Crown!")).toBeVisible();
  await expect(crownCard.getByRole("button", { name: "Current plan" })).toBeVisible();
  await expect(page.getByText("Active: Crown")).toBeVisible();
});

