import { test, expect } from "@playwright/test";
import { loginAsCustomer, dismissTourIfOpen } from "./helpers";

test.describe("Taste Match", () => {
  test("onboarding sets a taste profile, Marketplace shows a matching badge with an explanation and feedback, preferences persist and are editable from Profile", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // "What tastes like you?" onboarding banner appears for a fresh profile.
    const banner = page.locator("section").filter({ hasText: "What tastes like you?" });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole("button", { name: "Comfort Food", exact: true }).click();
    await banner.getByRole("button", { name: "Vegan", exact: true }).click();
    await banner.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(banner).toBeHidden();

    // A matching product now shows a Taste Match badge on its card.
    const badge = grid.getByRole("button", { name: /% Taste Match/ }).first();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await badge.click();
    await expect(page.getByText(/Because you like:/)).toBeVisible();
    await expect(page.getByRole("button", { name: "More like this" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Less like this" })).toBeVisible();
    await page.getByRole("button", { name: "More like this" }).click();
    await expect(page.getByText("We'll show you more like this")).toBeVisible();

    // Taste Match badges persist across a reload (state is saved locally and
    // mirrored to Supabase best-effort, not recomputed from scratch).
    await page.reload();
    await page.waitForSelector("text=Loading your ShePlates profile", { state: "hidden", timeout: 15_000 }).catch(() => {});
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(banner).toBeHidden();
    await expect(grid.getByRole("button", { name: /% Taste Match/ }).first()).toBeVisible({ timeout: 20_000 });

    // The profile page exposes the same choices, pre-selected, and editable.
    const accountTrigger = page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first();
    await accountTrigger.click();
    await page.getByRole("button", { name: "Profile & food", exact: true }).click();
    const preferences = page.locator("section").filter({ hasText: "Taste Match preferences" });
    await expect(preferences).toBeVisible();
    await expect(preferences.getByRole("button", { name: "Comfort Food", exact: true })).toHaveClass(/border-\[#[0-9a-f]{6}\]/);
    await preferences.getByRole("button", { name: "Spicy", exact: true }).click();
    await preferences.getByRole("button", { name: "Save taste preferences" }).click();
    await expect(page.getByText("Taste preferences saved")).toBeVisible();
  });
});
