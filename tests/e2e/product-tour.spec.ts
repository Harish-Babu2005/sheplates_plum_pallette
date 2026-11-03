import { test, expect } from "@playwright/test";
import { loginAsCustomer, resetTourCompletion, DEMO } from "./helpers";

test.describe("Customer product tour", () => {
  test("auto-opens once, can be skipped, does not reopen, and replays from Help", async ({ page }) => {
    await resetTourCompletion(DEMO.customer.email);
    await loginAsCustomer(page);

    const step1 = page.getByText("Step 1 of 9");
    await expect(step1).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Your delivery location")).toBeVisible();

    // Advance one step to confirm Back/Next progression and spotlight tracking work.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2 of 9")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    // Skip the rest.
    await page.getByRole("dialog", { name: "Product tour" }).getByRole("button", { name: "Skip", exact: true }).click();
    await expect(step1).not.toBeVisible();

    // A reload must not show the tour again for this user.
    await page.reload();
    await expect(page.getByText(/Step \d of 9/)).not.toBeVisible({ timeout: 5000 });

    // Replay from the account menu — the desktop header dropdown trigger or
    // the mobile bottom-nav "Profile" tab, whichever is actually visible.
    const accountTrigger = page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first();
    await accountTrigger.click();
    await page.getByRole("button", { name: /Help.*Product tour/ }).click();
    await expect(page.getByText("Step 1 of 9")).toBeVisible();
    await page.getByRole("dialog", { name: "Product tour" }).getByRole("button", { name: "Skip", exact: true }).click();
  });
});
