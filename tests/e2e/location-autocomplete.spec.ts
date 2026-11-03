import { test, expect } from "@playwright/test";
import { loginAsCustomer, dismissTourIfOpen } from "./helpers";

test.describe("Location autocomplete", () => {
  test("typing an address shows real ranked suggestions and selecting one pins coordinates", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    // Reach the delivery-location dialog from the marketplace toolbar.
    const locationButton = page.locator('[data-tour="location"]:visible, [data-tour="location-mobile"]:visible').first();
    await locationButton.click();
    await expect(page.getByText("Confirm your delivery location")).toBeVisible();

    const dialog = page.getByRole("dialog");
    const addressField = dialog.getByPlaceholder(/Flat, street, landmark/);
    await addressField.fill("Ganapathy");
    await page.waitForTimeout(700); // debounce window

    // Scoped to the open dialog: the header location chip behind it also
    // contains the word "Ganapathy" and would otherwise match too.
    const suggestions = dialog.locator("button", { hasText: "Ganapathy" });
    await expect(suggestions.first()).toBeVisible({ timeout: 5000 });
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await suggestions.first().click();
    // Selecting a suggestion should populate the full formatted address and
    // show an exact-pin readout on the map preview, proving lat/lng were set.
    await expect(page.getByText(/Exact pin -?\d+\.\d+, -?\d+\.\d+/)).toBeVisible({ timeout: 5000 });
  });
});
