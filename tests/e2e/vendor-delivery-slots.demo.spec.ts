import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

const SESSIONS = {
  vendor: { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] },
  customer: { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] },
};

async function openAs(page: Page, who: keyof typeof SESSIONS, tweak?: (state: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState();
  tweak?.(state);
  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, SESSIONS[who]] as const);
  await page.goto("/");
}

test.describe("Vendor Delivery Slot Configuration", () => {
  test("Vendor can view, validate, add, edit, toggle, and delete delivery slots", async ({ page }) => {
    await openAs(page, "vendor");
    await dismissTourIfOpen(page);

    await openStaffNavIfCollapsed(page);
    // Navigate to "Store & radius"
    const storeRadiusBtn = page.getByRole("button", { name: "Store & radius" }).first();
    await expect(storeRadiusBtn).toBeVisible({ timeout: 15_000 });
    await storeRadiusBtn.click();

    // Verify Delivery Slots section heading & description
    await expect(page.getByRole("heading", { name: "Delivery Slots" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Configure the time windows when your store can deliver orders.")).toBeVisible();

    // Verify existing demo slots from demo-state (Morning, Afternoon, Evening)
    await expect(page.getByText("Morning", { exact: true })).toBeVisible();
    await expect(page.getByText("Afternoon", { exact: true })).toBeVisible();
    await expect(page.getByText("Evening", { exact: true })).toBeVisible();

    // Click "Add Delivery Slot"
    const addSlotBtn = page.getByRole("button", { name: "Add Delivery Slot" });
    await expect(addSlotBtn).toBeVisible();
    await addSlotBtn.click();

    // Modal should appear
    await expect(page.getByRole("heading", { name: "Add Delivery Slot" })).toBeVisible();

    // Test validation 1: Empty slot name
    const slotNameInput = page.getByPlaceholder("e.g. Morning");
    await slotNameInput.fill("");
    await page.getByRole("button", { name: "Add Slot" }).click();
    await expect(page.getByText("Slot name is required.")).toBeVisible();

    // Test validation 2: Duplicate slot name
    await slotNameInput.fill("Morning");
    await page.getByRole("button", { name: "Add Slot" }).click();
    await expect(page.getByText('A delivery slot named "Morning" already exists for your store.')).toBeVisible();

    // Test validation 3: End time <= Start time
    await slotNameInput.fill("Night Owl");
    const startTimeInput = page.getByLabel("Start Time");
    const endTimeInput = page.getByLabel("End Time");
    await startTimeInput.fill("20:00");
    await endTimeInput.fill("18:00");
    await page.getByRole("button", { name: "Add Slot" }).click();
    await expect(page.getByText("End time must be later than start time.")).toBeVisible();

    // Test validation 4: Overlapping active slot (Morning is 09:00-11:00, test 10:00-12:00)
    await startTimeInput.fill("10:00");
    await endTimeInput.fill("12:00");
    await page.getByRole("button", { name: "Add Slot" }).click();
    await expect(page.getByText(/overlaps with active slot "Morning"/)).toBeVisible();

    // Successfully add a valid non-overlapping slot: "Tea Break" (14:30 to 15:30)
    await slotNameInput.fill("Tea Break");
    await startTimeInput.fill("14:30");
    await endTimeInput.fill("15:30");
    await page.getByRole("button", { name: "Add Slot" }).click();

    // Modal closes and "Tea Break" appears in slot list
    await expect(page.getByText("Tea Break", { exact: true })).toBeVisible();
    await expect(page.getByText("02:30 PM – 03:30 PM")).toBeVisible();

    // Toggle active status: toggle "Tea Break" to inactive
    const teaBreakCard = page.locator("div.border").filter({ hasText: "Tea Break" }).first();
    await expect(teaBreakCard).toBeVisible();

    // Click Active toggle button to switch to Disabled
    const toggleButton = teaBreakCard.getByRole("button", { name: "Active" });
    await toggleButton.click();

    // Should now show Disabled button
    await expect(teaBreakCard.getByRole("button", { name: "Disabled" })).toBeVisible();

    // Edit slot: Click edit on "Tea Break"
    const editBtn = teaBreakCard.getByRole("button", { name: "Edit slot" });
    await editBtn.click();
    await expect(page.getByRole("heading", { name: "Edit Delivery Slot" })).toBeVisible();

    // Change name to "Late Snack" and save
    await slotNameInput.fill("Late Snack");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Late Snack", { exact: true })).toBeVisible();

    // Delete slot: Delete "Late Snack" (listen for confirm dialog)
    const lateSnackCard = page.locator("div.border").filter({ hasText: "Late Snack" }).first();
    const deleteBtn = lateSnackCard.getByRole("button", { name: "Delete slot" });
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();

    // "Late Snack" should no longer be present
    await expect(page.getByText("Late Snack")).toHaveCount(0);
  });

  test("Customer checkout displays vendor's configured active delivery slots", async ({ page }) => {
    // Seed cart with Mini Meals (p-1) from vendor v-meena
    await openAs(page, "customer", (state) => {
      state.cart = [{ id: "cart-1", customerEmail: "customer@sheplates.demo", productId: "p-1", quantity: 1 }];
    });
    await dismissTourIfOpen(page);

    // Go to Cart
    const cartBtn = page.getByRole("button", { name: /Cart/i }).first();
    await cartBtn.click();

    // In Cart, Meena's item (Mini Meals) is now in cart. Click Continue to payment to open address & slot dialog.
    const continueBtn = page.getByRole("button", { name: "Continue to payment" });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();

    // Address & delivery dialog is open
    await expect(page.getByRole("heading", { name: "Choose a delivery address" })).toBeVisible({ timeout: 5_000 });

    // Verify "Delivery time window" field is visible
    await expect(page.getByText("Delivery time window")).toBeVisible();

    // Verify vendor's delivery slots are in the select dropdown options
    const slotTrigger = page.locator("button[role='combobox']").filter({ hasText: /Morning|Afternoon|Evening/ });
    await expect(slotTrigger).toBeVisible();

    // Click the slot trigger to open the options list
    await slotTrigger.click();

    // Check that options include formatted times (with hyphen)
    await expect(page.getByRole("option", { name: /Morning \(09:00 AM - 11:00 AM\)/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Afternoon \(12:00 PM - 02:00 PM\)/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Evening \(04:00 PM - 06:00 PM\)/ })).toBeVisible();
  });
});
