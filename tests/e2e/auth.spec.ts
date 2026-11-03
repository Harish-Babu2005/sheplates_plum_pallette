import { test, expect } from "@playwright/test";
import { DEMO } from "./helpers";

test.describe("Authentication", () => {
  test("customer can sign in with valid credentials", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
    await expect(page.getByText("Customer access")).toBeVisible();
    await page.getByLabel("Email").fill(DEMO.customer.email);
    await page.getByLabel("Password").fill(DEMO.customer.password);
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    // Either the authenticated shell (marketplace search) or first-login
    // onboarding ("Where should we serve you?") is a valid signed-in state.
    const marketplaceSearch = page.getByPlaceholder("Search food, vendor, category, dietary tag…");
    const onboarding = page.getByText("Where should we serve you?");
    await expect(marketplaceSearch.or(onboarding)).toBeVisible({ timeout: 15_000 });
  });

  test("invalid password shows a real error, not a silent failure", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
    await page.getByLabel("Email").fill(DEMO.customer.email);
    await page.getByLabel("Password").fill("WrongPassword123");
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Invalid login credentials|could not be verified/i)).toBeVisible({ timeout: 10_000 });
  });

  test("sign-in dialog stays fully on-screen on a phone-width viewport", async ({ page }) => {
    // Regression test for the translate-vs-transform bug: the dialog used to
    // render with its center pinned at (8,8) instead of its top-left corner,
    // pushing most of it off-screen on any viewport under 640px.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
    }
  });
});
