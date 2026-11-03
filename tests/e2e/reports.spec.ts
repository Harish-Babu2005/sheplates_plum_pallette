import { test, expect } from "@playwright/test";
import { loginAsStaff, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

test.describe("Reports centre", () => {
  test("operations can preview the default Orders report and download it as a real Excel file", async ({ page }) => {
    await loginAsStaff(page, "operations");
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Reports" }).click();

    await expect(page.getByRole("heading", { name: "Custom reports" })).toBeVisible();
    // "Orders" is the default selection and is backed by real Supabase data
    // (state.orders), unlike "Vendor payments"/"Support tickets"/"Cancellations"
    // which are local-mock-only and would legitimately show empty here.
    await expect(page.getByRole("heading", { name: "Orders preview" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Excel" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("sheplates-orders-report.xlsx");
  });

  test("admin sees the same Reports centre with the same report catalogue", async ({ page }) => {
    await loginAsStaff(page, "admin");
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Reports" }).click();

    await expect(page.getByRole("heading", { name: "Custom reports" })).toBeVisible();
    await page.getByLabel("Report").click();
    for (const label of ["Orders", "Zoho Books daily order export", "Vendor payments", "Support tickets", "Vendor directory", "Cancellations", "Customers"]) {
      await expect(page.getByRole("option", { name: label })).toBeVisible();
    }
  });
});
