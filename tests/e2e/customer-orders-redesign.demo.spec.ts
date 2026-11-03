import { test, expect, type Page } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

async function openAsCustomer(page: Page) {
  const state = buildDemoState();
  const session = {
    email: DEMO_CUSTOMER.email,
    name: DEMO_CUSTOMER.name,
    role: "customer",
    toursCompleted: ["customer_v1", "customer_profile_v1", "marketplace_v1"],
  };

  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, session] as const);

  await page.goto("/");
  await dismissTourIfOpen(page);
  await expect(page.getByRole("button", { name: "Orders", exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("Customer Orders & Live Tracking Redesign (Demo Mode)", () => {
  test("Order cards render clean e-commerce UI without embedded maps, with timeline and action buttons", async ({ page }) => {
    await openAsCustomer(page);

    // Navigate to Orders
    await page.getByRole("button", { name: "Orders", exact: true }).first().click();
    await dismissTourIfOpen(page);

    // Verify Heading and Dashboard Metric Cards with exact match
    await expect(page.getByText("Orders & live tracking", { exact: true })).toBeVisible();
    await expect(page.getByText("Paid orders", { exact: true })).toBeVisible();
    await expect(page.getByText("Active schedules", { exact: true })).toBeVisible();
    await expect(page.getByText("Open requirements", { exact: true })).toBeVisible();
    await expect(page.getByText("Order value", { exact: true })).toBeVisible();

    // Verify Order Card elements
    const orderCard = page.locator(".surface-card").filter({ hasText: /View Details/i }).first();
    await expect(orderCard).toBeVisible();

    // Verify NO embedded map inside the card
    await expect(orderCard.locator(".leaflet-container, [data-testid='pin-map']")).toHaveCount(0);

    // Verify Compact Delivery Timeline steps
    await expect(orderCard.getByText("Order Placed", { exact: true }).first()).toBeVisible();
    await expect(orderCard.getByText("Vendor Confirmed", { exact: true }).first()).toBeVisible();
    await expect(orderCard.getByText("Out for Delivery", { exact: true }).first()).toBeVisible();
    await expect(orderCard.getByText("Delivered", { exact: true }).first()).toBeVisible();

    // Verify Action buttons
    const viewDetailsBtn = orderCard.getByRole("button", { name: /View Details/i });
    const trackOrderBtn = orderCard.getByRole("button", { name: /Track Order/i });
    await expect(viewDetailsBtn).toBeVisible();
    await expect(trackOrderBtn).toBeVisible();

    // 1. Test "View Details" dialog
    await viewDetailsBtn.click();
    const detailsDialog = page.getByRole("dialog");
    await expect(detailsDialog).toBeVisible();
    await expect(detailsDialog.getByRole("heading", { name: "Order Details" })).toBeVisible();
    await expect(detailsDialog.getByText("Store & Kitchen")).toBeVisible();
    await expect(detailsDialog.getByText("Scheduled Fulfilment")).toBeVisible();
    await expect(detailsDialog.getByText("Delivery Address")).toBeVisible();
    await expect(detailsDialog.getByText("Ordered Items")).toBeVisible();
    await expect(detailsDialog.getByText("Payment Information")).toBeVisible();
    await detailsDialog.getByRole("button", { name: "Close" }).first().click();
    await expect(detailsDialog).not.toBeVisible();

    // 2. Test "Track Order" dialog
    await trackOrderBtn.click();
    const trackDialog = page.getByRole("dialog");
    await expect(trackDialog).toBeVisible();
    await expect(trackDialog.getByRole("heading", { name: "Live Order Tracking" })).toBeVisible();
    await expect(trackDialog.getByText("Delivery Progress")).toBeVisible();
    await expect(trackDialog.getByText("Live GPS Map Tracking")).toBeVisible();
    // Track Order must not have embedded map
    await expect(trackDialog.locator(".leaflet-container, [data-testid='pin-map']")).toHaveCount(0);
    await trackDialog.getByRole("button", { name: "Back to Orders" }).click();
    await expect(trackDialog).not.toBeVisible();
  });
});
