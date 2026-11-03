import { test, expect } from "@playwright/test";
import { loginAsStaff, loginAsCustomer, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

// Known seeded vendor with real published products (see DELIVERY_SUMMARY.md).
const KANDAN_FOODS_ID = "118bd5e1-5e05-4c7b-a8f7-1db5c4f0f747";

test.describe("Vendor QR code deep link", () => {
  test("vendor sees a generated QR code with a downloadable image on the storefront page", async ({ page }) => {
    await loginAsStaff(page, "vendor");
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Online shop & POS" }).click();
    await expect(page.getByText("Your shop QR code")).toBeVisible({ timeout: 10_000 });
    const qrImage = page.locator('img[alt^="QR code for"]');
    await expect(qrImage).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Download QR/ })).toBeVisible();
  });

  test("a signed-in customer opening a vendor's QR link lands filtered to that vendor's shop", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    await expect(page.getByRole("button", { name: /Viewing Kandan Foods/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Viewing Kandan Foods/ }).click();
    await expect(page.getByRole("button", { name: /Viewing Kandan Foods/ })).not.toBeVisible();
  });

  test("a signed-out visitor opening a vendor's QR link is prompted to sign in", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    await expect(page.getByText("Customer access")).toBeVisible({ timeout: 10_000 });
  });
});
