import { test, expect } from "@playwright/test";
import { loginAsCustomer, dismissTourIfOpen } from "./helpers";

test.describe("Marketplace — Add to Cart and Schedule are independent", () => {
  test("product cards expose separate Add and Plan actions, and Add updates the cart badge", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const firstCard = grid.locator("article").first();
    await expect(firstCard).toBeVisible();

    const addButton = firstCard.getByRole("button", { name: "Add" });
    const planButton = firstCard.getByRole("button", { name: "Plan" });
    await expect(addButton).toBeVisible();
    await expect(planButton).toBeVisible();

    const cartButton = page.locator('[data-tour="cart"]');
    const before = (await cartButton.textContent()) || "";

    await addButton.click();
    await page.waitForTimeout(800); // cart sync round-trip
    const after = (await cartButton.textContent()) || "";
    expect(after).not.toBe(before);

    await cartButton.click();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByRole("dialog")).toContainText("Choose a delivery address");
    await expect(page.getByRole("dialog")).toContainText("Use a new address");
  });

  test("Plan opens a schedule dialog independent of the cart, and states the payment-gating rule", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const firstCard = grid.locator("article").first();
    await firstCard.getByRole("button", { name: "Plan" }).click();

    await expect(page.getByText(/^Schedule /)).toBeVisible();
    // Regression guard for the schedule payment-gating bug: the dialog must
    // say the schedule stays pending until payment, not that it activates immediately.
    await expect(page.getByText(/remains in checkout until payment/i)).toBeVisible();
    await expect(page.getByText(/Fulfilment/i)).toBeVisible();
  });
});
