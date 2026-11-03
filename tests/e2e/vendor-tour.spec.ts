import { test, expect } from "@playwright/test";
import { loginAsStaff, resetTourCompletion, DEMO } from "./helpers";

test.describe("Vendor product tour", () => {
  test("auto-opens for a vendor and can be replayed from the sidebar", async ({ page }) => {
    await resetTourCompletion(DEMO.vendor.email);
    await loginAsStaff(page, "vendor");
    await expect(page.getByText("Step 1 of 10")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("Step 1 of 10")).not.toBeVisible();

    await page.getByRole("button", { name: /Help.*Product tour/ }).click();
    await expect(page.getByText("Step 1 of 10")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
  });
});
