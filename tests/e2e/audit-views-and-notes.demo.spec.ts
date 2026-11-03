import { expect, test } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";

const OPS = { email: "operations@sheplates.demo", name: "Ops", role: "operations", toursCompleted: ["operations_v1"] };
const ADMIN = { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] };

async function open(page: import("@playwright/test").Page, session: typeof OPS, nav: string, pending = false) {
  const state = buildDemoState();
  if (pending) state.vendors[0] = { ...state.vendors[0], verification: "Submitted" };
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, session] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  await go(page, nav);
}

async function go(page: import("@playwright/test").Page, nav: string) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: new RegExp(`^${nav}\\s*\\d*$`) }).click();
}

test("opening a customer's details is recorded in the audit log", async ({ page }) => {
  await open(page, ADMIN, "Users");
  await page.getByRole("tab", { name: /Customers/ }).click().catch(() => undefined);
  await page.getByRole("button", { name: "View details" }).first().click();
  await expect(page.getByRole("heading", { name: "Customer details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await go(page, "Audit log");
  await expect(page.getByText("Viewed customer details").first()).toBeVisible();
});

test("operations can write a note to the vendor when asking for changes", async ({ page }) => {
  await open(page, OPS, "Vendor verification", true);
  const note = page.getByLabel("Note to the vendor");
  await expect(note).toBeVisible();
  await note.fill("Please upload a clearer FSSAI photo");
  await page.getByRole("button", { name: "Ask for changes" }).click();
  await expect(page.getByText("Changes required").first()).toBeVisible();
});

test("onboarding has the invitation email switch", async ({ page }) => {
  await open(page, OPS, "Vendor onboarding");
  await page.getByRole("button", { name: "Start onboarding" }).first().click().catch(() => undefined);
  const toggle = page.getByRole("switch", { name: "Send the vendor an invitation email" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByPlaceholder("owner@theirbusiness.com")).toBeVisible();
});
