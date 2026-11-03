import { test, expect } from "@playwright/test";
import { loginAsCustomer, switchTo, dismissTourIfOpen } from "./helpers";

test.describe("Wishlist", () => {
  test("saving a product from the marketplace shows it on the Wishlist page, and removing it clears it", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const firstCard = grid.locator("article").first();
    const productName = (await firstCard.locator("h3").first().textContent())?.trim();
    const saveButton = firstCard.getByRole("button", { name: "Save to wishlist" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toHaveAttribute("aria-pressed", "false");
    await saveButton.click();
    await expect(firstCard.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "Remove from wishlist" })).toHaveAttribute("aria-pressed", "true");

    const accountTrigger = page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first();
    await accountTrigger.click();
    await page.getByRole("button", { name: "Wishlist", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your wishlist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: productName! })).toBeVisible();

    await page.getByRole("button", { name: "Remove from wishlist" }).click();
    await expect(page.getByText("Your wishlist is empty")).toBeVisible();
  });
});

test.describe("Product ratings & reviews", () => {
  test("marketplace product cards show a seeded star rating, and a vendor sees an aggregate rating and customer feedback", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    // Dummy ratings are auto-seeded for every real product, so every card in
    // a freshly loaded marketplace should show a star row with a review count.
    const firstCard = grid.locator("article").first();
    await expect(firstCard.getByText(/\(\d+\)/)).toBeVisible({ timeout: 10_000 });

    await switchTo(page, "vendor");
    await dismissTourIfOpen(page);
    await expect(page.getByRole("heading", { name: "Murugan Daily Foods" })).toBeVisible();
    await expect(page.getByText("Customer rating")).toBeVisible();
    await expect(page.getByText(/review/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customer feedback" })).toBeVisible();
  });
});
