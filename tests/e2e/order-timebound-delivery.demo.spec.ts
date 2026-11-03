import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

const VENDOR_SESSION = {
  email: "v-meena@sheplates.demo",
  name: "Meena",
  role: "vendor",
  toursCompleted: ["vendor_v1"],
};

async function openVendorWithFutureOrder(page: Page) {
  const state = buildDemoState();
  const tomorrowDate = day(1);
  // Add an order specifically scheduled for tomorrow for vendor v-meena
  state.orders.push({
    id: "ORD-FUTURE-TEST",
    customerEmail: "customer@sheplates.demo",
    vendorId: "v-meena",
    productId: state.products[0].id,
    description: "Mini Meals Tomorrow",
    quantity: 1,
    unit: "1 complete meal",
    total: 120,
    date: tomorrowDate,
    slot: "07:00–08:00 AM",
    mode: "Vendor delivery",
    status: "Confirmed",
    payment: "Paid",
  });

  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, VENDOR_SESSION] as const);

  await page.goto("/");
}

test("vendor cannot advance an order scheduled for tomorrow to delivery statuses", async ({ page }) => {
  await openVendorWithFutureOrder(page);
  await dismissTourIfOpen(page);

  // Navigate to Orders
  await openStaffNavIfCollapsed(page);
  const ordersNav = page.getByRole("button", { name: "Orders" }).first();
  await expect(ordersNav).toBeVisible({ timeout: 15_000 });
  await ordersNav.click();

  // Switch to Tomorrow date view to view tomorrow's orders
  const tomorrowButton = page.getByRole("button", { name: "Tomorrow" });
  await expect(tomorrowButton).toBeVisible();
  await tomorrowButton.click();

  // The future order should be visible
  const orderCard = page.locator(".surface-card", { hasText: "Mini Meals Tomorrow" }).first();
  await expect(orderCard).toBeVisible();

  // Find the status select trigger for this order
  const statusTrigger = orderCard.getByRole("combobox").nth(1); // second select is status (first is assign delivery)
  await expect(statusTrigger).toBeVisible();
  await statusTrigger.click();

  // Check that delivery statuses are disabled
  const outForDeliveryOption = page.getByRole("option", { name: "Out for delivery" });
  await expect(outForDeliveryOption).toBeVisible();
  await expect(outForDeliveryOption).toHaveAttribute("data-disabled", "");

  const completedOption = page.getByRole("option", { name: "Completed" });
  await expect(completedOption).toBeVisible();
  await expect(completedOption).toHaveAttribute("data-disabled", "");

  const preparingOption = page.getByRole("option", { name: "Preparing" });
  await expect(preparingOption).toBeVisible();
  await expect(preparingOption).toHaveAttribute("data-disabled", "");
});

