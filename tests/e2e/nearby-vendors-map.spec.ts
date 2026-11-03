import { test, expect } from "@playwright/test";
import { loginAsCustomer, dismissTourIfOpen } from "./helpers";

test.describe("Maps tab — interactive nearby-vendors map", () => {
  test("opens from the Maps tab and the radius stepper updates the in-range count", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    await page.getByRole("button", { name: "Maps", exact: true }).click();
    await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^\d+ km · \d+ vendors? in range/)).toBeVisible();

    const increase = page.getByRole("button", { name: "Increase radius" });
    await expect(increase).toBeVisible();
    await increase.click();
    await expect(page.getByText(/^11 km · \d+ vendors? in range/)).toBeVisible();

    const decrease = page.getByRole("button", { name: "Decrease radius" });
    await decrease.click();
    await expect(page.getByText(/^10 km · \d+ vendors? in range/)).toBeVisible();

    // The customer's own position must always render, regardless of whether
    // any vendor has a saved coordinate yet (that needs the V7_6 migration).
    await expect(page.locator(".sp-map-you")).toBeVisible();
  });

  test("tapping a vendor pin shows its card, and View opens the public vendor profile with Follow", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    await page.getByRole("button", { name: "Maps", exact: true }).click();
    const map = page.locator(".sp-vendor-map");
    await expect(map).toBeVisible({ timeout: 10_000 });

    const pin = map.locator(".sp-map-photo-pin").first();
    await expect(pin).toBeVisible({ timeout: 10_000 });
    await pin.hover();
    await expect(map.locator(".sp-map-vendor-tooltip")).toBeVisible();
    await expect(map.locator(".sp-map-vendor-tooltip")).toHaveText(/\S+/);
    await pin.click();
    await page.getByRole("button", { name: "View", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^(Follow|Following)$/ })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Menu" })).toBeVisible();
  });

  test("the food trail is gone: no trail button on the map", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);
    await page.getByRole("button", { name: "Maps", exact: true }).click();
    await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "My food trail" })).toHaveCount(0);
  });
});
