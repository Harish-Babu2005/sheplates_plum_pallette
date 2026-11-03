import { test } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";

// The purchase flow at website and phone widths: kitchen page, product plan, cart, checkout. Saved to qa-screenshots/redesign/.
test("customer purchase flow", async ({ page }, info) => {
  test.setTimeout(120_000);
  const state = buildDemoState();
  const session = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, session] as const);
  await page.goto("/");
  await page.waitForSelector("header.k-head");
  const shot = (n: string) => page.screenshot({ path: `qa-screenshots/redesign/${info.project.name}-flow-${n}.png` });
  await page.getByRole("button", { name: /^Open Meena/ }).first().click();
  await page.waitForTimeout(800);
  await shot("kitchen");
  await page.getByRole("button", { name: /^Add/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.locator('[data-tour="cart"]').click();
  await page.waitForTimeout(800);
  await shot("cart");
});
