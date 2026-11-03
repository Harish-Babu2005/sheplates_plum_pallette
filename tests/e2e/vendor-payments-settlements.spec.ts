import { test, expect } from "@playwright/test";
import { loginAsCustomer, switchTo, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

test.describe("Vendor payments & settlements", () => {
  test("a completed customer payment shows up for Operations (with a payout action) and Admin (read-only), and the payout stays locked until it's overdue", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    // Schedule the first product and pay for it — this is what actually
    // creates a Transaction that Settlements/Vendor payments read from.
    const grid = page.locator('[data-tour="products"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const firstCard = grid.locator("article").first();
    const vendorName = (await firstCard.locator("p").first().textContent())?.split(" · ")[0]?.trim();
    const productName = (await firstCard.locator("h3").first().textContent())?.trim();
    await firstCard.getByRole("button", { name: "Plan" }).click();
    await expect(page.getByText(/^Schedule /)).toBeVisible();
    await page.getByRole("button", { name: "Continue to payment" }).click();

    // Saving a schedule navigates to Cart. If this account has exactly one
    // pending order the payment dialog auto-opens; if earlier local runs left
    // other pending orders behind it won't, so pay for our own order by name
    // either way rather than assuming which state we land in.
    await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible({ timeout: 20_000 });
    const closeDialog = page.getByRole("button", { name: "Close" });
    if (await closeDialog.isVisible().catch(() => false)) await closeDialog.click();
    const awaitingRow = page.locator(".surface-card", { hasText: productName || "" }).filter({ has: page.getByRole("button", { name: "Pay & place order" }) });
    await awaitingRow.first().getByRole("button", { name: "Pay & place order" }).click();
    const payButton = page.getByRole("button", { name: /^Pay ₹/ });
    await expect(payButton).toBeVisible({ timeout: 10_000 });
    await payButton.click();
    await expect(payButton).not.toBeVisible({ timeout: 10_000 });

    // Operations manages payouts: the vendor now shows real income, and
    // "Mark payout paid" is disabled because a same-day payment hasn't
    // reached its scheduled payout date yet (PAYOUT_CYCLE_DAYS later).
    await switchTo(page, "operations");
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Vendor payments" }).click();
    await expect(page.getByRole("heading", { name: "Vendor-wise income & payouts" })).toBeVisible();
    const vendorRow = vendorName ? page.locator("tr", { hasText: vendorName }) : page.locator("tbody tr").first();
    await expect(vendorRow).toBeVisible();
    await expect(vendorRow.getByRole("button", { name: "Mark payout paid" })).toBeDisabled();

    // Admin gets the same data but strictly view-only — no payout action at all.
    await switchTo(page, "admin");
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Vendor payments" }).click();
    await expect(page.getByRole("heading", { name: "Vendor-wise income & payouts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark payout paid" })).not.toBeVisible();
  });
});
