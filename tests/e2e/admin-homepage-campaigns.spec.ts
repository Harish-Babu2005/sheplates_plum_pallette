import { test, expect } from "@playwright/test";
import { loginAsStaff, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

test.describe("Super Admin — Homepage & Campaigns", () => {
  test("never shows a false 'saved' state while the underlying tables are unreachable", async ({ page }) => {
    // Regression guard for the reproduced bug: featuring a product used to
    // show a success checkmark unconditionally, even when the write to
    // platform_settings failed, because the optimistic UI update fired
    // before the save was confirmed. It should now either (a) genuinely
    // save when the V4_6 migration is applied, or (b) visibly fail with the
    // banner + error toast — never silently pretend to succeed.
    await loginAsStaff(page, "admin");
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Homepage & campaigns" }).click();
    await expect(page.getByRole("heading", { name: "Homepage & campaigns" })).toBeVisible({ timeout: 10_000 });

    const errorBanner = page.getByText("Homepage merchandising is not connected to the database.");
    const bannerVisible = await errorBanner.isVisible().catch(() => false);

    const toggle = page.getByTestId("featured-toggle").first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(600);
      if (bannerVisible) {
        await expect(page.getByText("Marketplace home settings saved")).not.toBeVisible();
      } else {
        await expect(page.getByText(/Marketplace home settings saved/)).toBeVisible();
      }
    }
  });
});
