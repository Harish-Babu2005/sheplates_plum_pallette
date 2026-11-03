import { test, expect } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";

// The delivery-pin picker must show a real map (it used to be a blank frame). Works on either map engine.
test("the delivery pin dialog shows a map with the pin", async ({ page }) => {
  test.setTimeout(60_000); // with real Ola credentials set, the map loads over the network
  const state = buildDemoState();
  const session = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, session] as const);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /RS Puram|Change delivery|delivery location/i }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Save this delivery pin" });
  await expect(dialog).toBeVisible();
  const map = dialog.locator("[data-map-engine]");
  await expect(map).toBeVisible({ timeout: 15_000 });
  // a drawn map: a canvas (Ola) or loaded tiles (standard), and the pin on top
  await expect(map.locator("canvas, .leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  await expect(map.locator(".sp-map-you")).toBeVisible();
  await expect(dialog.getByText(/Exact pin 1\d\.\d+, 7\d\.\d+/)).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveCount(0);
});
