import { test, expect } from "@playwright/test";
import { dismissTourIfOpen } from "./helpers";

test("Customer onboarding and profile options are standardized, prefilled, and retained across sign-out", async ({ page }) => {
  test.setTimeout(60_000);
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 11.02, longitude: 76.99 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // 1. Create a new customer account
  const customerEmail = `profile-test-${Date.now()}@example.com`;
  const customerPassword = "CustomerTest@123";

  await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Full name").fill("Profile Test Customer");
  await page.getByLabel("Email").fill(customerEmail);
  await page.getByLabel("Password").fill(customerPassword);
  await page.locator("form").getByRole("button", { name: "Create account" }).click();

  // 2. Step 1: Location & Household
  await expect(page.getByText("Customer setup · 1/3")).toBeVisible();
  const addressInput = page.getByPlaceholder("Flat, street, landmark, area, city and PIN");
  await addressInput.fill("123 Test Street, Ganapathy, Coimbatore");
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Exact pin 11\.020000, 76\.990000/)).toBeVisible();

  const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
  await continueBtn.click();

  // 3. Step 2: Food preferences (select Diet: Vegetarian, Allergies: Milk & Peanut, Goals: High protein)
  await expect(page.getByText("Customer setup · 2/3")).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Vegetarian", exact: true }).click();

  // Toggle allergies
  await page.getByRole("button", { name: "Milk", exact: true }).click();
  await page.getByRole("button", { name: "Peanut", exact: true }).click();

  // Toggle health goals
  await page.getByRole("button", { name: "High protein", exact: true }).click();

  // Instructions
  await page.getByPlaceholder("Example: no coriander, mild spice").fill("Extra crispy, no onion");

  await continueBtn.click();

  // 4. Step 3: Review and finish
  await expect(page.getByText("Customer setup · 3/3")).toBeVisible();
  await expect(page.getByText("Vegetarian")).toBeVisible();
  await expect(page.getByText(/Milk,\s*Peanut/)).toBeVisible();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();

  // Land on Marketplace
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
  await dismissTourIfOpen(page);

  // 5. Navigate to Profile page ("Profile & food") via Profile tab
  if ((page.viewportSize()?.width ?? 1280) >= 768) await page.locator('[data-tour="account"]').click(); // desktop: Profile lives in the account menu
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Profile & food" }).click();

  // Confirm profile page loaded
  await expect(page.getByRole("heading", { name: "Addresses, food preferences & She Agent memory" })).toBeVisible();

  // Verify that options are prefilled from onboarding:
  // Diet Select shows Vegetarian
  await expect(page.locator("button[role='combobox']").filter({ hasText: "Vegetarian" })).toBeVisible();

  // Allergies show standard chips with checkmarks for selected ones
  await expect(page.getByRole("button", { name: "✓ Milk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ Peanut" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Gluten" })).toBeVisible();

  // Goals show standard chips with checkmarks
  await expect(page.getByRole("button", { name: "✓ High protein" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Balanced meals" })).toBeVisible();

  // Instructions
  await expect(page.getByPlaceholder("Example: no coriander, mild spice")).toHaveValue("Extra crispy, no onion");

  // 6. Edit profile: Add Phone, toggle additional allergy "Gluten", add custom goal "Maintain weight"
  await page.getByPlaceholder("+91 ...").fill("+91 9876543210");
  await page.getByRole("button", { name: "+ Gluten" }).click();
  await expect(page.getByRole("button", { name: "✓ Gluten" })).toBeVisible();

  const customGoalsInput = page.getByPlaceholder("Other goals (comma separated)");
  await customGoalsInput.fill("Maintain weight");

  // Click Save profile
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile and default address saved")).toBeVisible();

  // 7. Sign out (navigate to Profile tab and click Sign out)
  if ((page.viewportSize()?.width ?? 1280) >= 768) await page.locator('[data-tour="account"]').click(); // desktop: Profile lives in the account menu
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Signed out")).toBeVisible();

  // 8. Sign back in as the same customer
  await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  await page.getByLabel("Email").fill(customerEmail);
  await page.locator('input[type="password"]').fill(customerPassword);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
  await dismissTourIfOpen(page);

  // 9. Navigate back to "Profile & food"
  if ((page.viewportSize()?.width ?? 1280) >= 768) await page.locator('[data-tour="account"]').click(); // desktop: Profile lives in the account menu
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Profile & food" }).click();

  await expect(page.getByRole("heading", { name: "Addresses, food preferences & She Agent memory" })).toBeVisible();

  // 10. Verify all prefilled values are retained!
  await expect(page.getByPlaceholder("+91 ...")).toHaveValue("+91 9876543210");
  await expect(page.locator("button[role='combobox']").filter({ hasText: "Vegetarian" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ Milk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ Peanut" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ Gluten" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ High protein" })).toBeVisible();
  await expect(customGoalsInput).toHaveValue("Maintain weight");
  await expect(page.getByPlaceholder("Example: no coriander, mild spice")).toHaveValue("Extra crispy, no onion");
});
