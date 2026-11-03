import { test, expect } from "@playwright/test";
import { loginAsCustomer, switchTo, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

const SUBJECT = `E2E delivery delay ${Date.now()}`;

test.describe("Ticket centre", () => {
  test("customer raises a ticket, operations resolves it, and admin's oversight view reflects the resolution", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);

    const accountTrigger = page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first();
    await accountTrigger.click();
    await page.getByRole("button", { name: "Ticket centre" }).click();
    await page.getByLabel("Subject").fill(SUBJECT);
    await page.getByLabel("Details").fill("Playwright E2E: my last delivery arrived two hours late.");
    await page.getByRole("button", { name: "Create ticket" }).click();

    const ticketCard = page.locator(".surface-card", { hasText: SUBJECT });
    await expect(ticketCard).toBeVisible();
    await expect(ticketCard.getByText("Open", { exact: true })).toBeVisible();

    // Operations is the only role with a Resolve action.
    await switchTo(page, "operations");
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Ticket centre" }).click();
    const opsTicketCard = page.locator(".surface-card", { hasText: SUBJECT });
    await expect(opsTicketCard).toBeVisible();
    await opsTicketCard.getByRole("button", { name: "Resolve" }).click();
    await expect(opsTicketCard.getByText("Resolved", { exact: true })).toBeVisible();
    await expect(opsTicketCard.getByRole("button", { name: "Resolve" })).not.toBeVisible();

    // Admin gets a platform-wide, read-only oversight view — no create form,
    // no Resolve action, but the same ticket and its resolved status.
    await switchTo(page, "admin");
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Ticket centre" }).click();
    await expect(page.getByText(/ticket\(s\) currently open across the platform/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ticket" })).not.toBeVisible();
    const adminTicketCard = page.locator(".surface-card", { hasText: SUBJECT });
    await expect(adminTicketCard).toBeVisible();
    await expect(adminTicketCard.getByText("Resolved", { exact: true })).toBeVisible();
    await expect(adminTicketCard.getByRole("button", { name: "Resolve" })).not.toBeVisible();
  });
});
