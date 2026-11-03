import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const CUSTOMER_SESSION = {
  email: "customer@sheplates.demo",
  name: "Arun",
  role: "customer",
  toursCompleted: ["customer_v1"],
};

async function openCustomerWithPendingOrder(page: Page, scheduledDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) {
  const state = buildDemoState();

  // Ensure customer onboarding is marked complete
  const customer = state.customers.find((c) => c.email === CUSTOMER_SESSION.email);
  if (customer) {
    customer.onboardingComplete = true;
    customer.address = "12 Main St, Ganapathy, Coimbatore";
    customer.latitude = 11.02;
    customer.longitude = 76.99;
  }

  // Seed a pending order awaiting payment in cart
  state.orders.unshift({
    id: "ORD-PAY-DEMO-1",
    customerEmail: CUSTOMER_SESSION.email,
    vendorId: "v-meena",
    productId: state.products[0].id,
    description: "Mini Meals Daily",
    quantity: 1,
    unit: "1 complete meal",
    total: 120,
    date: scheduledDate,
    slot: "07:00–08:00 AM",
    mode: "Vendor delivery",
    status: "Scheduled",
    payment: "Pending",
  });

  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, CUSTOMER_SESSION] as const);

  await page.goto("/");
}

test.describe("Demo Mode Payment Dialog Flow", () => {
  test("past-dated unpaid orders cannot be paid", async ({ page }) => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await openCustomerWithPendingOrder(page, yesterday);
    await dismissTourIfOpen(page);
    await page.getByRole("button", { name: /Cart/i }).first().click();

    const orderCard = page.locator(".surface-card", { hasText: "Mini Meals Daily" }).first();
    await expect(orderCard).toBeVisible();
    await expect(orderCard.getByRole("button", { name: "Scheduled date passed" })).toBeDisabled();
    await expect(orderCard).toContainText("Payment unavailable: the scheduled date has passed.");
    await expect(page.getByRole("dialog", { name: /Pay for/i })).toHaveCount(0);
    await expect(orderCard.getByRole("button", { name: /Remove unpaid order/i })).toHaveCount(0);
  });

  test("awaiting-payment orders remain listed without a delete action", async ({ page }) => {
    await openCustomerWithPendingOrder(page);
    await dismissTourIfOpen(page);
    await page.getByRole("button", { name: /Cart/i }).first().click();

    const orderCard = page.locator(".surface-card", { hasText: "Mini Meals Daily" }).first();
    await expect(orderCard).toBeVisible();
    await expect(orderCard.getByRole("button", { name: /Remove unpaid order/i })).toHaveCount(0);
    await expect(orderCard.getByRole("button", { name: "Pay & place order" })).toBeVisible();
  });

  test("pending order displays payment dialog and completes demo payment", async ({ page }) => {
    await openCustomerWithPendingOrder(page);
    await dismissTourIfOpen(page);

    // Open Cart from top bar
    const cartBtn = page.getByRole("button", { name: /Cart/i }).first();
    await expect(cartBtn).toBeVisible({ timeout: 15_000 });
    await cartBtn.click();

    // Awaiting payment section with order should be visible
    await expect(page.getByText("Awaiting payment")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("ORD-PAY-DEMO-1").or(page.getByText("Mini Meals Daily"))).toBeVisible();

    // Click Pay & place order
    const payOrderBtn = page.getByRole("button", { name: /Pay & place order/i }).first();
    await expect(payOrderBtn).toBeVisible();
    await payOrderBtn.click();

    // Payment dialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Pay for ORD-PAY-DEMO-1/i)).toBeVisible();
    await expect(dialog.getByText(/Simulated secure checkout/i)).toBeVisible();
    await expect(dialog.getByText(/Amount payable/i)).toBeVisible();

    // In demo mode, payment method options are visible
    await expect(dialog.getByRole("button", { name: "UPI" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Card" })).toBeVisible();

    // Click confirm pay
    const paySubmitBtn = dialog.getByRole("button", { name: /^Pay ₹120$/i });
    await expect(paySubmitBtn).toBeVisible();
    await paySubmitBtn.click();

    // Toast appears
    await expect(page.getByText(/Payment confirmed/i)).toBeVisible({ timeout: 10_000 });
  });
});
