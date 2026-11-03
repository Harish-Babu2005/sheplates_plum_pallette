import { test, expect } from "@playwright/test";

test("new customer must confirm and save a movable delivery pin before continuing", async ({ page }) => {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 11.02, longitude: 76.99 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /Customer login|^Sign in$/ })).toBeVisible();
  await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  await expect(page.getByText("Customer access")).toBeVisible();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Full name").fill("New Location Customer");
  await page.getByLabel("Email").fill(`new-location-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("CustomerTest@123");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Customer setup · 1/3")).toBeVisible();
  const continueButton = page.getByRole("button", { name: "Continue", exact: true });
  const address = page.getByPlaceholder("Flat, street, landmark, area, city and PIN");
  await address.fill("Address typed without a confirmed pin");
  await continueButton.click();
  await expect(page.getByText("Customer setup · 1/3")).toBeVisible();

  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Exact pin 11\.020000, 76\.990000/)).toBeVisible();

  await address.fill("Ganapathy");
  const suggestionButton = page.getByRole("button").filter({ hasText: "Ganapathy" }).first();
  await expect(suggestionButton).toBeVisible();
  await suggestionButton.click();
  const pinReadout = page.getByText(/Exact pin -?\d+\.\d{6}, -?\d+\.\d{6}/);
  await expect(pinReadout).toBeVisible();
  const selectedPin = await pinReadout.textContent();
  expect(selectedPin).toMatch(/^Exact pin -?\d+\.\d{6}, -?\d+\.\d{6}$/);
  await page.waitForTimeout(500);

  const map = page.locator('[data-map-engine="standard"]');
  const pin = map.locator(".leaflet-marker-draggable").last();
  await expect(pin).toBeVisible();
  const pinBox = await pin.boundingBox();
  expect(pinBox).not.toBeNull();
  const start = { x: pinBox!.x + pinBox!.width / 2, y: pinBox!.y + pinBox!.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect(pinReadout).not.toHaveText(selectedPin!);
  await expect(address).not.toHaveValue("");
  const savedAddress = await address.inputValue();
  const movedPin = (await pinReadout.textContent())?.match(/^Exact pin (-?\d+\.\d{6}), (-?\d+\.\d{6})$/);
  expect(movedPin).not.toBeNull();

  await continueButton.click();
  await expect(page.getByText("Customer setup · 2/3")).toBeVisible();
  await continueButton.click();
  await expect(page.getByText("Customer setup · 3/3")).toBeVisible();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();

  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("sheplates-v3-state") || "{}");
    return state.customers?.find((customer: { email: string }) => customer.email.startsWith("new-location-"));
  });
  expect(saved.address).toBe(savedAddress);
  expect(saved.latitude).toBe(Number(movedPin![1]));
  expect(saved.longitude).toBe(Number(movedPin![2]));
});
