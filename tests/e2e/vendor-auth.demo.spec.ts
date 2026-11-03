import { test, expect } from "@playwright/test";

test("new vendor can sign in again after signing out", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /^Vendor( \/ Team)?$/ }).click();
  await expect(page.getByText("Vendor / Team access")).toBeVisible();
  await page.getByText("Be part of our vendor team").click();
  await page.getByLabel("Full name").fill("Test Vendor");
  await page.getByLabel("Email").fill("test-vendor@example.com");
  await page.locator('input[type="password"]').fill("VendorTest@123");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Vendor onboarding · 1/4")).toBeVisible();

  const category = page.getByRole("combobox").first();
  await category.click();
  await expect(page.getByRole("option", { name: "Snacks", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Caterer", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Caterer", exact: true }).click();
  await expect(category).toContainText("Caterer");
  await category.click();
  await page.getByRole("option", { name: "Snacks", exact: true }).click();
  await expect(category).toContainText("Snacks");
  await category.click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await expect(page.getByPlaceholder("Enter your business category")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((toast) => toast.remove()));
  await page.getByRole("button", { name: /^Vendor( \/ Team)?$/ }).click();
  await page.getByLabel("Email").fill("test-vendor@example.com");
  await page.locator('input[type="password"]').fill("VendorTest@123");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Vendor onboarding · 1/4")).toBeVisible();
});
